import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Type definitions
interface FileInsight {
  file: string;
  analysis: string;
  score: number;
  size: number;
  extension: string;
}

interface GitHubFile {
  path: string;
  type: string;
  size: number;
  url: string;
}

interface GitHubTreeResponse {
  tree: GitHubFile[];
}

interface GitHubRepoResponse {
  name: string;
  default_branch: string;
}

interface TechStack {
  languages: Record<string, number>;
  frameworks: string[];
  tools: string[];
  architecture_patterns: string[];
  security_issues_count: number;
  quality_issues_count: number;
}

interface AnalysisRecord {
  id: string;
  user_id: string;
  repo_url: string;
  status: string;
}

interface GitHubFileContent {
  content?: string;
  encoding?: string;
  size: number;
  name: string;
  path: string;
}

interface GroqChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  allowedHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
  methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json());

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.sendStatus(200);
});

// Helper function to clean AI response
function cleanAiResponse(text: string): string {
  // Remove all asterisks
  let cleaned = text.replace(/\*/g, '');
  // Remove markdown headers
  cleaned = cleaned.replace(/#+\s*/g, '');
  // Remove markdown list items
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');
  // Remove extra whitespace
  cleaned = cleaned.replace(/^\s*|\s*$/gm, '');
  // Ensure numbered lists use plain numbers
  cleaned = cleaned.replace(/^\s*(\d+)\.\s+/gm, '$1. ');
  return cleaned;
}

// Helper function to validate response format
function validateResponseFormat(text: string): boolean {
  // Check for forbidden characters
  if (/[*#_\-]/.test(text)) return false;
  // Check basic structure
  if (!text.includes('SCORE:') || !text.includes('TOP 5 ACTIONABLE RECOMMENDATIONS:')) return false;
  return true;
}

app.post('/analyze-repository', async (req, res) => {
  try {
    const { repoUrl }: { repoUrl: string } = req.body;
    
    // Get auth user
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const supabaseClient = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_ANON_KEY ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('Starting comprehensive analysis for repo:', repoUrl);

    // Create initial analysis record
    const { data: analysis, error: insertError } = await supabaseClient
      .from('analyses')
      .insert({
        user_id: user.id,
        repo_url: repoUrl,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to create analysis record: ' + insertError.message);
    }

    const analysisRecord = analysis as AnalysisRecord;
    console.log('Created analysis record:', analysisRecord.id);

    // Fetch repository files from GitHub API
    const repoPath = repoUrl.replace('https://github.com/', '');
    const [owner, repo] = repoPath.split('/');
    
    const repoApiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    console.log('Fetching repository info...');
    // Get repository info
    const repoResponse = await fetch(repoApiUrl);
    if (!repoResponse.ok) {
      throw new Error(`Repository not found or not accessible: ${repoResponse.status}`);
    }
    const repoData: GitHubRepoResponse = await repoResponse.json() as GitHubRepoResponse;

    console.log('Fetching comprehensive file tree...');
    // Get complete file tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.default_branch}?recursive=1`;
    const treeResponse = await fetch(treeUrl);
    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch file tree: ${treeResponse.status}`);
    }
    const treeData: GitHubTreeResponse = await treeResponse.json() as GitHubTreeResponse;

    // Comprehensive file analysis - analyze ALL relevant files
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.vue', '.svelte', '.dart', '.scala', '.clj', '.hs', '.ml', '.r', '.sql'];
    const configExtensions = ['.json', '.yml', '.yaml', '.toml', '.xml', '.ini', '.env', '.config'];
    const docExtensions = ['.md', '.txt', '.rst'];

    const allFiles = treeData.tree.filter((file: GitHubFile) => {
      if (file.type !== 'blob') return false;
      if (file.path.includes('node_modules') || file.path.includes('.git') || file.path.includes('dist/') || file.path.includes('build/')) return false;
      if (file.size > 100000) return false; // Skip very large files
      
      const hasRelevantExtension = [...codeExtensions, ...configExtensions, ...docExtensions].some(ext => file.path.endsWith(ext));
      const isConfigFile = ['package.json', 'composer.json', 'Dockerfile', 'requirements.txt', 'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod'].some(name => file.path.endsWith(name));
      
      return hasRelevantExtension || isConfigFile;
    });

    console.log(`Found ${allFiles.length} files for comprehensive analysis`);

    if (allFiles.length === 0) {
      // No files found
      const { error: updateError } = await supabaseClient
        .from('analyses')
        .update({
          status: 'completed',
          stack_score: 1,
          summary: `Repository analyzed but no supported files found.`,
          suggestions: ['Add supported file types and frameworks to improve analysis'],
          tech_stack: { languages: {}, frameworks: [], tools: [] },
          file_insights: []
        })
        .eq('id', analysisRecord.id);

      if (updateError) {
        throw new Error('Failed to update analysis: ' + updateError.message);
      }

      return res.json({ 
        success: true, 
        analysisId: analysisRecord.id,
        score: 1,
        filesAnalyzed: 0 
      });
    }

    // Initialize comprehensive analysis data
    const fileInsights: FileInsight[] = [];
    const suggestions: string[] = [];
    const languageStats: Record<string, number> = {};
    const frameworks = new Set<string>();
    const tools = new Set<string>();
    const architecturePatterns = new Set<string>();
    const codeQualityIssues: string[] = [];
    const securityIssues: string[] = [];

    // Group files for efficient processing
    const codeFiles = allFiles.filter(f => codeExtensions.some(ext => f.path.endsWith(ext)));
    const configFiles = allFiles.filter(f => 
      configExtensions.some(ext => f.path.endsWith(ext)) || 
      ['package.json', 'composer.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod'].some(name => f.path.endsWith(name))
    );

    console.log(`Analyzing ${codeFiles.length} code files and ${configFiles.length} config files`);

    // Helper function to decode base64 content
    const decodeBase64 = (content: string): string => {
      return Buffer.from(content, 'base64').toString('utf-8');
    };

    // Process config files first for tech stack detection
    for (const file of configFiles) {
      try {
        console.log(`Analyzing config file: ${file.path}`);
        const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) continue;
        
        const fileData: GitHubFileContent = await fileResponse.json() as GitHubFileContent;
        if (fileData.content) {
          const content = decodeBase64(fileData.content);
          
          // Detect frameworks and tools from config files
          if (file.path.endsWith('package.json')) {
            try {
              const packageJson = JSON.parse(content);
              const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
              Object.keys(deps).forEach(dep => {
                if (dep.includes('react')) frameworks.add('React');
                if (dep.includes('vue')) frameworks.add('Vue.js');
                if (dep.includes('angular')) frameworks.add('Angular');
                if (dep.includes('express')) frameworks.add('Express.js');
                if (dep.includes('next')) frameworks.add('Next.js');
                if (dep.includes('svelte')) frameworks.add('Svelte');
                if (dep.includes('webpack')) tools.add('Webpack');
                if (dep.includes('vite')) tools.add('Vite');
                if (dep.includes('typescript')) tools.add('TypeScript');
                if (dep.includes('eslint')) tools.add('ESLint');
                if (dep.includes('prettier')) tools.add('Prettier');
                if (dep.includes('jest')) tools.add('Jest');
                if (dep.includes('cypress')) tools.add('Cypress');
              });
            } catch (parseError) {
              console.error('Error parsing package.json:', parseError);
            }
          }
          
          if (file.path.endsWith('requirements.txt')) {
            const lines = content.split('\n');
            lines.forEach(line => {
              if (line.includes('django')) frameworks.add('Django');
              if (line.includes('flask')) frameworks.add('Flask');
              if (line.includes('fastapi')) frameworks.add('FastAPI');
              if (line.includes('pandas')) tools.add('Pandas');
              if (line.includes('numpy')) tools.add('NumPy');
              if (line.includes('tensorflow')) frameworks.add('TensorFlow');
              if (line.includes('pytorch')) frameworks.add('PyTorch');
            });
          }
          
          if (file.path.endsWith('Cargo.toml')) {
            frameworks.add('Rust');
            if (content.includes('tokio')) frameworks.add('Tokio');
            if (content.includes('actix')) frameworks.add('Actix Web');
          }
          
          if (file.path.endsWith('go.mod')) {
            frameworks.add('Go Modules');
            if (content.includes('gin-gonic')) frameworks.add('Gin');
            if (content.includes('gorilla')) frameworks.add('Gorilla');
          }
        }
      } catch (error) {
        console.error('Error analyzing config file:', file.path, error);
      }
    }

    // Process code files in batches for comprehensive analysis
    const batchSize = 10;
    for (let i = 0; i < codeFiles.length; i += batchSize) {
      const batch = codeFiles.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(codeFiles.length/batchSize)}`);
      
      const batchPromises = batch.map(async (file: GitHubFile): Promise<FileInsight | null> => {
        try {
          const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
          const fileResponse = await fetch(fileUrl);
          if (!fileResponse.ok) return null;
          
          const fileData: GitHubFileContent = await fileResponse.json() as GitHubFileContent;
          if (!fileData.content) return null;
          
          const content = decodeBase64(fileData.content);
          const fileExtension = file.path.split('.').pop() || 'unknown';
          
          // Count languages
          languageStats[fileExtension] = (languageStats[fileExtension] || 0) + 1;
          
          // Detect architecture patterns and frameworks from code
          if (content.includes('class ') && content.includes('extends')) architecturePatterns.add('Object-Oriented');
          if (content.includes('function') && content.includes('=>')) architecturePatterns.add('Functional Programming');
          if (content.includes('import') && content.includes('from')) architecturePatterns.add('Modular Architecture');
          if (content.includes('async') && content.includes('await')) architecturePatterns.add('Asynchronous Programming');
          if (content.includes('useState') || content.includes('useEffect')) frameworks.add('React Hooks');
          if (content.includes('@Component') || content.includes('@Injectable')) frameworks.add('Angular');
          if (content.includes('@RestController') || content.includes('@Service')) frameworks.add('Spring Boot');

          // Enhanced prompt with strict formatting rules
          const prompt = `You are a senior software engineer conducting a comprehensive code review. Analyze this ${fileExtension} file and provide structured feedback.

STRICT FORMATTING RULES:
1. Use ONLY plain text with no formatting characters whatsoever
2. Absolutely NO asterisks (*), dashes (-), or markdown of any kind
3. NO bullet points or list markers except plain numbers (1., 2., etc.)
4. Do not use any special characters for emphasis
5. If you violate these rules, the analysis will fail

FILE: ${file.path}
CODE SAMPLE: ${content.substring(0, 3000)}

Provide your analysis in this exact format:

SCORE: [Number from 1-10]

FILE PURPOSE: [Description]

CODE QUALITY REVIEW:
Structure and Organization: [Assessment]
Naming Conventions: [Assessment] 
Readability and Documentation: [Assessment]
Error Handling: [Assessment]
Performance Considerations: [Assessment]

ARCHITECTURE ANALYSIS:
Design Patterns Used: [Assessment]
Architectural Decisions: [Assessment]
Separation of Concerns: [Assessment]
Code Modularity: [Assessment]

SECURITY REVIEW:
Input Validation: [Assessment]
Authentication and Authorization: [Assessment]
Data Exposure Risks: [Assessment]
Security Vulnerabilities: [List]

TECHNICAL DEBT ASSESSMENT:
Code Smells Identified: [Assessment]
Deprecated Practices: [Assessment]
Maintainability Score: [Assessment]
Refactoring Priority: [Assessment]

TOP 5 ACTIONABLE RECOMMENDATIONS:
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]
4. [Recommendation]
5. [Recommendation]`;

          const groqApiKey = process.env.GROQ_API_KEY;
          if (!groqApiKey) {
            console.error('GROQ_API_KEY not found');
            return null;
          }

          let attempts = 0;
          let analysis = '';
          let validResponse = false;

          while (attempts < 3 && !validResponse) {
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 800,
              }),
            });

            if (groqResponse.ok) {
              const groqData: GroqChatResponse = await groqResponse.json() as GroqChatResponse;
              analysis = groqData.choices[0].message.content;
              
              // Clean the response
              analysis = cleanAiResponse(analysis);
              validResponse = validateResponseFormat(analysis);
              
              if (!validResponse) {
                console.log(`Retrying analysis for ${file.path} (attempt ${attempts + 1}) due to formatting issues`);
              }
            } else {
              console.error(`GROQ API error for file ${file.path}:`, await groqResponse.text());
              return null;
            }
            attempts++;
          }

          if (!validResponse) {
            console.error(`Failed to get properly formatted response for ${file.path} after 3 attempts`);
            return null;
          }

          // Parse AI response
          const scoreMatch = analysis.match(/SCORE:\s*(\d+)/i);
          const fileScore = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : 7;
          
          // Extract insights
          const qualityIssuesMatch = analysis.match(/CODE QUALITY REVIEW:\s*([^]*?)(?=ARCHITECTURE ANALYSIS:|SECURITY REVIEW:|TECHNICAL DEBT ASSESSMENT:|TOP 5 ACTIONABLE RECOMMENDATIONS:|$)/i);
          const securityIssuesMatch = analysis.match(/SECURITY REVIEW:\s*([^]*?)(?=CODE QUALITY REVIEW:|ARCHITECTURE ANALYSIS:|TECHNICAL DEBT ASSESSMENT:|TOP 5 ACTIONABLE RECOMMENDATIONS:|$)/i);
          const recommendationsMatch = analysis.match(/TOP 5 ACTIONABLE RECOMMENDATIONS:\s*([^]*?)(?=CODE QUALITY REVIEW:|ARCHITECTURE ANALYSIS:|SECURITY REVIEW:|TECHNICAL DEBT ASSESSMENT:|$)/i);
          
          if (qualityIssuesMatch && qualityIssuesMatch[1].trim()) {
            codeQualityIssues.push(`${file.path}: ${qualityIssuesMatch[1].trim()}`);
          }
          
          if (securityIssuesMatch && securityIssuesMatch[1].trim()) {
            securityIssues.push(`${file.path}: ${securityIssuesMatch[1].trim()}`);
          }
          
          if (recommendationsMatch && recommendationsMatch[1].trim()) {
            suggestions.push(`${file.path}: ${recommendationsMatch[1].trim()}`);
          }

          return {
            file: file.path,
            analysis: analysis,
            score: fileScore,
            size: file.size,
            extension: fileExtension
          };
        } catch (fileError) {
          console.error('Error analyzing file:', file.path, fileError);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result): result is FileInsight => result !== null);
      fileInsights.push(...validResults);
    }

    // Calculate comprehensive final score
    let finalScore = 0;
    if (fileInsights.length > 0) {
      const avgCodeQuality = fileInsights.reduce((sum, file) => sum + file.score, 0) / fileInsights.length;
      const architectureBonus = architecturePatterns.size > 0 ? Math.min(2, architecturePatterns.size * 0.5) : 0;
      const frameworkBonus = frameworks.size > 0 ? Math.min(1, frameworks.size * 0.2) : 0;
      const securityPenalty = securityIssues.length > 0 ? Math.min(2, securityIssues.length * 0.3) : 0;
      
      finalScore = Math.max(1, Math.min(10, Math.round(avgCodeQuality + architectureBonus + frameworkBonus - securityPenalty)));
    } else {
      finalScore = 1;
    }

    // Generate comprehensive summary
    const avgQuality = fileInsights.length > 0 ? 
      Math.round((fileInsights.reduce((sum, file) => sum + file.score, 0) / fileInsights.length) * 10) / 10 : 0;

    const summary = `Comprehensive analysis of ${repoData.name}: Analyzed ${fileInsights.length} files across ${Object.keys(languageStats).length} languages. 
    
Architecture: ${Array.from(architecturePatterns).join(', ') || 'Basic structure detected'}
Frameworks: ${Array.from(frameworks).join(', ') || 'No major frameworks detected'}
Code Quality: Average score ${avgQuality}/10
Security: ${securityIssues.length} potential security concerns identified
Technical Debt: ${codeQualityIssues.length} code quality issues found`;

    console.log(`Comprehensive analysis complete. Final score: ${finalScore}`);
    
    // Update analysis with comprehensive results
    const techStack: TechStack = { 
      languages: languageStats,
      frameworks: Array.from(frameworks),
      tools: Array.from(tools),
      architecture_patterns: Array.from(architecturePatterns),
      security_issues_count: securityIssues.length,
      quality_issues_count: codeQualityIssues.length
    };

    const { error: updateError } = await supabaseClient
      .from('analyses')
      .update({
        status: 'completed',
        stack_score: finalScore,
        summary: summary,
        suggestions: [...suggestions.slice(0, 10), ...codeQualityIssues.slice(0, 5), ...securityIssues.slice(0, 5)],
        tech_stack: techStack,
        file_insights: fileInsights
      })
      .eq('id', analysisRecord.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update analysis: ' + updateError.message);
    }

    console.log('Comprehensive analysis completed successfully');

    return res.json({ 
      success: true, 
      analysisId: analysisRecord.id,
      score: finalScore,
      filesAnalyzed: fileInsights.length,
      languages: Object.keys(languageStats).length,
      frameworks: frameworks.size,
      securityIssues: securityIssues.length
    });

  } catch (error) {
    console.error('Error in analyze-repository function:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Repository analysis API server running on port ${port}`);
});

export default app;