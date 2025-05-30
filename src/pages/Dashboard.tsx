import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Code2, LogOut, User, GitBranch, Upload, Zap, TrendingUp, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Dashboard = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState({
    analysisCount: 0,
    avgScore: 0,
    totalFiles: 0,
    avgTime: 0
  });

  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserAnalyses();
    }
  }, [user]);

  const fetchUserAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAnalyses(data || []);
      
      // Calculate stats
      const completedAnalyses = data?.filter(a => a.status === 'completed') || [];
      const avgScore = completedAnalyses.length > 0 
        ? completedAnalyses.reduce((sum, a) => sum + (a.stack_score || 0), 0) / completedAnalyses.length 
        : 0;
      
      // Safely handle file_insights which is Json type
      const totalFiles = completedAnalyses.reduce((sum, a) => {
        const fileInsights = a.file_insights;
        if (Array.isArray(fileInsights)) {
          return sum + fileInsights.length;
        }
        return sum;
      }, 0);

      setStats({
        analysisCount: data?.length || 0,
        avgScore: Math.round(avgScore * 10) / 10,
        totalFiles,
        avgTime: 2.3 // Mock for now since we don't track time yet
      });
    } catch (error) {
      console.error('Error fetching analyses:', error);
      toast.error('Failed to load your analyses');
    }
  };

  const simulateProgress = () => {
    setAnalysisProgress(0);
    setAnalysisStep('Initializing analysis...');
    
    const steps = [
      { progress: 20, step: 'Connecting to repository...' },
      { progress: 40, step: 'Fetching repository structure...' },
      { progress: 60, step: 'Running AI analysis...' },
      { progress: 80, step: 'Processing insights...' },
      { progress: 95, step: 'Finalizing results...' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setAnalysisProgress(steps[currentStep].progress);
        setAnalysisStep(steps[currentStep].step);
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 500); // Reduced from 2000ms to 500ms for faster progress updates

    return interval;
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (stats.analysisCount >= 5) {
      toast.error('You have reached your analysis limit (5/5)');
      return;
    }

    setIsAnalyzing(true);
    const progressInterval = simulateProgress();
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-repository', {
        body: { repoUrl }
      });

      clearInterval(progressInterval);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.success) {
        setAnalysisProgress(100);
        setAnalysisStep('Analysis completed!');
        toast.success(`Analysis completed! Score: ${data.score}/10`);
        
        setTimeout(() => {
          navigate(`/results/${data.analysisId}`);
        }, 1000);
        
        await fetchUserAnalyses(); // Refresh data
      } else {
        throw new Error(data?.error || 'Analysis failed');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze repository');
      setAnalysisProgress(0);
      setAnalysisStep('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">StackCompass</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="border-purple-500 text-purple-700 bg-purple-50">
                {stats.analysisCount}/5 analyses used
              </Badge>
              <Button variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                <User className="w-4 h-4 mr-2" />
                {user?.email}
              </Button>
              <Button onClick={handleSignOut} variant="ghost" size="sm" className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-xl text-gray-700">Analyze your codebase and get AI-powered insights</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Analysis Section */}
            <div className="lg:col-span-2">
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-purple-600" />
                    Analyze Repository
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Enter a GitHub repository URL to get AI-powered insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="github" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                      <TabsTrigger value="github" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
                        <GitBranch className="w-4 h-4 mr-2" />
                        GitHub URL
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="text-gray-700 data-[state=active]:text-gray-900 data-[state=active]:bg-white">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload ZIP
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="github" className="mt-6">
                      <form onSubmit={handleAnalyze} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="repoUrl" className="text-gray-700">Repository URL</Label>
                          <Input
                            id="repoUrl"
                            type="url"
                            placeholder="https://github.com/username/repository"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                            required
                            disabled={isAnalyzing}
                          />
                        </div>
                        
                        {isAnalyzing && (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-gray-700">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                              <span className="text-sm">{analysisStep}</span>
                            </div>
                            <Progress value={analysisProgress} className="w-full" />
                            <div className="text-xs text-gray-600 text-center">
                              {analysisProgress}% complete
                            </div>
                          </div>
                        )}
                        
                        <Button 
                          type="submit" 
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                          disabled={isAnalyzing || stats.analysisCount >= 5}
                        >
                          {isAnalyzing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Analyzing Repository...
                            </>
                          ) : stats.analysisCount >= 5 ? (
                            'Analysis Limit Reached'
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Run AI Analysis
                            </>
                          )}
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="upload" className="mt-6">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                        <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Upload a ZIP file of your codebase</p>
                        <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100">
                          Choose File
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              {/* Usage Stats */}
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg">Your Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Analyses Used</span>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200">{stats.analysisCount}/5</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Plan</span>
                    <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">Beta</Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(stats.analysisCount / 5) * 100}%` }}
                    ></div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="text-gray-900 font-semibold">
                        {stats.avgScore > 0 ? stats.avgScore : 'N/A'}
                      </div>
                      <div className="text-gray-600 text-sm">Avg. Stack Score</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="text-gray-900 font-semibold">{stats.totalFiles}</div>
                      <div className="text-gray-600 text-sm">Files Analyzed</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="text-gray-900 font-semibold">{stats.avgTime} min</div>
                      <div className="text-gray-600 text-sm">Avg. Analysis Time</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recent Analyses */}
          <div className="mt-12">
            <Card className="bg-white/70 border-gray-200 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="text-gray-900">Recent Analyses</CardTitle>
                <CardDescription className="text-gray-600">
                  Your latest repository analyses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analyses.length === 0 ? (
                  <div className="text-center py-8">
                    <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No analyses yet. Start by analyzing your first repository!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analyses.map((analysis: any) => (
                      <div key={analysis.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center space-x-4">
                          <GitBranch className="w-5 h-5 text-purple-600" />
                          <div>
                            <div className="text-gray-900 font-medium">
                              {analysis.repo_url || analysis.file_name || 'Repository Analysis'}
                            </div>
                            <div className="text-gray-600 text-sm">{formatTimeAgo(analysis.created_at)}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {analysis.status === 'completed' ? (
                            <>
                              <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center space-x-1">
                                <CheckCircle className="w-3 h-3" />
                                <span>Score: {analysis.stack_score}/10</span>
                              </Badge>
                              <Link to={`/results/${analysis.id}`}>
                                <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                                  View Report
                                </Button>
                              </Link>
                            </>
                          ) : analysis.status === 'pending' ? (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center space-x-1">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-yellow-800"></div>
                              <span>Analyzing...</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center space-x-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Failed</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
