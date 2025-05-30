import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Download,
  Share2,
  ArrowLeft,
  Star,
  GitBranch,
  Zap,
  Package,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ShareDialog from '@/components/ShareDialog';
import { generatePDFReport, generateWordReport } from '@/utils/reportGenerator';

const Results = () => {
  const { id } = useParams();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchAnalysis();
    }
  }, [id]);

  const fetchAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setAnalysisData(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
      toast.error('Failed to load analysis results');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format: 'pdf' | 'word') => {
    if (!analysisData) return;
    
    if (format === 'pdf') {
      generatePDFReport(analysisData);
      toast.success('PDF report downloaded!');
    } else {
      generateWordReport(analysisData);
      toast.success('Word report downloaded!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-700">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading analysis results...</span>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50 flex items-center justify-center">
        <div className="text-center text-gray-700">
          <h1 className="text-2xl font-bold mb-4">Analysis Not Found</h1>
          <Link to="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Safely handle Json types with proper type checking
  const fileInsights = Array.isArray(analysisData.file_insights) ? analysisData.file_insights : [];
  const suggestions = Array.isArray(analysisData.suggestions) ? analysisData.suggestions : [];
  const techStack = analysisData.tech_stack || {};
  const languages = (techStack && typeof techStack === 'object' && 'languages' in techStack) 
    ? techStack.languages || {} 
    : {};

  // Process language data for display with safe type checking
  const languageData = Object.entries(languages).map(([lang, count]: [string, any]) => {
    const countValue = typeof count === 'number' ? count : 0;
    
    // Calculate total count safely
    const allCounts = Object.values(languages).map((val: any) => typeof val === 'number' ? val : 0);
    const totalCount = allCounts.reduce((a: number, b: number) => a + b, 0);
    
    return {
      name: lang.toUpperCase(),
      count: countValue,
      percentage: totalCount > 0 ? Math.round((countValue / totalCount) * 100) : 0
    };
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Link>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-900 font-semibold">StackCompass</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
                onClick={() => setShareDialogOpen(true)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <div className="relative group">
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-1">
                    <button 
                      onClick={() => handleDownload('pdf')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Download as PDF
                    </button>
                    <button 
                      onClick={() => handleDownload('word')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Download as Word
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header Info */}
          <div className="mb-8">
            <div className="flex items-center space-x-2 text-gray-600 mb-2">
              <GitBranch className="w-4 h-4" />
              <span className="text-sm">{analysisData.repo_url || analysisData.file_name}</span>
              <span className="text-sm">• Analyzed {formatDate(analysisData.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-4xl font-bold text-gray-900">Analysis Results</h1>
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {analysisData.stack_score || 'N/A'}
                  </div>
                  <div className="text-gray-600 text-sm">Stack Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <FileText className="w-8 h-8 text-blue-600" />
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{fileInsights.length}</div>
                <div className="text-gray-600 text-sm">Files Analyzed</div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Code2 className="w-8 h-8 text-green-600" />
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{languageData.length}</div>
                <div className="text-gray-600 text-sm">Languages Used</div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Package className="w-8 h-8 text-purple-600" />
                  <CheckCircle className="w-5 h-5 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.keys(techStack).filter(key => key !== 'languages').length}
                </div>
                <div className="text-gray-600 text-sm">Tech Components</div>
              </CardContent>
            </Card>

            <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                  <Zap className="w-5 h-5 text-orange-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{suggestions.length}</div>
                <div className="text-gray-600 text-sm">AI Suggestions</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white/50 border border-gray-200 mb-8">
              <TabsTrigger value="overview" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Overview</TabsTrigger>
              <TabsTrigger value="suggestions" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">AI Analysis</TabsTrigger>
              <TabsTrigger value="frameworks" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">Tech Stack</TabsTrigger>
              <TabsTrigger value="files" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">File Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Language Distribution */}
                <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Language Distribution</CardTitle>
                    <CardDescription className="text-gray-600">
                      Programming languages found in your codebase
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {languageData.map((lang) => (
                        <div key={lang.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                            <span className="text-gray-700">{lang.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-900 font-medium">{lang.count} files</span>
                            <span className="text-gray-600">({lang.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Analysis Summary</CardTitle>
                    <CardDescription className="text-gray-600">
                      Overview of your codebase analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-gray-900 font-medium mb-2">Project Summary</h4>
                        <p className="text-gray-700 text-sm">
                          {analysisData.summary || 'AI analysis completed successfully.'}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-gray-900 font-medium mb-2">Analysis Status</h4>
                        <Badge className={
                          analysisData.status === 'completed' 
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : analysisData.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                            : 'bg-red-100 text-red-800 border-red-200'
                        }>
                          {analysisData.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4">
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">AI-Generated Insights</CardTitle>
                  <CardDescription className="text-gray-600">
                    Recommendations and Insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestions.length === 0 ? (
                    <p className="text-gray-600">No specific suggestions generated for this analysis.</p>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((suggestion: string, index: number) => (
                        <div key={index} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-start space-x-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                              <Zap className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700 whitespace-pre-wrap">{suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="frameworks" className="space-y-4">
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">Technology Stack</CardTitle>
                  <CardDescription className="text-gray-600">
                    Frameworks and libraries detected in your codebase
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(techStack)
                      .filter(([key]) => key !== 'languages')
                      .map(([file, tech]: [string, any]) => (
                        <div key={file} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center space-x-3 mb-2">
                            <Package className="w-5 h-5 text-purple-600" />
                            <span className="text-gray-900 font-medium">{file}</span>
                          </div>
                          <p className="text-gray-700 text-sm ml-8">{tech}</p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900">File-by-File Analysis</CardTitle>
                  <CardDescription className="text-gray-600">
                    Detailed AI analysis for each file in your repository
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {fileInsights.length === 0 ? (
                    <p className="text-gray-600">No file insights available for this analysis.</p>
                  ) : (
                    <div className="space-y-6">
                      {fileInsights.map((file: any, index: number) => (
                        <div key={index} className="p-6 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <FileText className="w-5 h-5 text-blue-600" />
                              <span className="text-gray-900 font-medium">{file.file}</span>
                            </div>
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              Score: {file.score}/10
                            </Badge>
                          </div>
                          <div className="prose prose-gray max-w-none">
                            <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {file.analysis}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ShareDialog 
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        analysisId={id!}
        repoUrl={analysisData.repo_url}
        stackScore={analysisData.stack_score}
      />
    </div>
  );
};

export default Results;
