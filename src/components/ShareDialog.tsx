import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Twitter, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from "framer-motion";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  repoUrl?: string;
  stackScore?: number;
}

const ShareDialog = ({ open, onOpenChange, analysisId, repoUrl, stackScore }: ShareDialogProps) => {
  const shareUrl = `${window.location.origin}/results/${analysisId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('🔗 Link copied to clipboard!');
    } catch {
      toast.error('❌ Failed to copy link');
    }
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`StackCompass Analysis Results${repoUrl ? ` - ${repoUrl}` : ''}`);
    const body = encodeURIComponent(`Check out this AI-powered codebase analysis: ${shareUrl}${stackScore ? `\n\nStack Score: ${stackScore}/10` : ''}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaSocial = (platform: 'twitter' | 'linkedin') => {
    const text = encodeURIComponent(`Just analyzed my codebase with StackCompass.in ! ${stackScore ? `Got a ${stackScore}/10 stack score. ` : ''}Check it out:`);
    const url = encodeURIComponent(shareUrl);
    if (platform === 'twitter') {
      window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`);
    } else {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[#101014] border border-[#2c2c2e] shadow-xl rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">🚀 Share Analysis Report</DialogTitle>
          <DialogDescription className="text-gray-400">
            Share your StackCompass insights with your peers or online.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5 mt-4"
        >
          <div className="space-y-2">
            <Label htmlFor="share-url" className="text-gray-300">🔗 Shareable Link</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                value={shareUrl}
                readOnly
                className="bg-gray-800 border border-gray-600 text-white"
              />
              <Button onClick={copyToClipboard} size="icon" className="bg-gray-700 hover:bg-gray-600 text-white">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {stackScore && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300">📊 Stack Score:</span>
              <Badge className="bg-purple-500/20 text-purple-300">
                {stackScore}/10
              </Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-300">📤 Share Via</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={shareViaEmail}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email
              </Button>
              <Button
                onClick={() => shareViaSocial('twitter')}
                className="bg-[#1DA1F2] hover:bg-[#1a91da] text-white"
              >
                <Twitter className="w-4 h-4 mr-2" />
                Twitter (X)
              </Button>
              <Button
                onClick={() => shareViaSocial('linkedin')}
                className="bg-[#0077b5] hover:bg-[#00639c] text-white"
              >
                <Linkedin className="w-4 h-4 mr-2" />
                LinkedIn
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
