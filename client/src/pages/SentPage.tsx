import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft } from 'lucide-react';

export default function SentPage() {
  const location = useLocation();
  const { email, repo } = location.state || {
    email: 'your email',
    repo: 'the repository',
  };

  return (
    <Card className="border-[#e1e4e8] shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden">
      <CardHeader className="p-10 pb-6 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#f6f8fa] rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#2da44e]" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-[#24292e]">
          Check your email
        </CardTitle>
      </CardHeader>
      <CardContent className="p-10 pt-0 text-center">
        <p className="text-base text-[#444d56] mb-8">
          We've sent a confirmation email to{' '}
          <strong className="text-[#24292e]">{email}</strong>. Please click the
          link in the email to confirm your subscription to{' '}
          <code className="bg-[#f6f8fa] px-1.5 py-0.5 rounded border border-[#e1e4e8] font-mono text-sm text-[#24292e]">
            {repo}
          </code>{' '}
          releases.
        </p>
        <div className="space-y-4">
          <p className="text-sm text-[#6a737d]">
            Didn't receive the email? Check your spam folder or try subscribing
            again.
          </p>
          <Link
            to="/"
            className="inline-flex items-center text-[#0366d6] hover:underline font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to subscribe
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
