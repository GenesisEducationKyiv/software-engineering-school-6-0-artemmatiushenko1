import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function SubscribePage() {
  const [email, setEmail] = useState('');
  const [repo, setRepo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !repo) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!repo.includes('/')) {
      toast.error('Repository must be in owner/repo format');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, repo }),
      });

      if (response.ok) {
        navigate('/sent', { state: { email, repo } });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-[#e1e4e8] shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden">
      <CardHeader className="p-10 pb-6">
        <CardTitle className="text-2xl font-bold text-[#24292e]">
          Subscribe to Releases
        </CardTitle>
        <CardDescription className="text-base text-[#444d56] mt-4">
          Get instant email notifications whenever a new release is published
          for your favorite GitHub repositories. Stay up to date with the latest
          features, bug fixes, and improvements.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-10 pt-0">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="repo"
              className="text-sm font-semibold text-[#24292e]"
            >
              GitHub Repository
            </Label>
            <Input
              id="repo"
              placeholder="owner/repo (e.g. facebook/react)"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="border-[#e1e4e8] focus-visible:ring-[#0366d6]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-semibold text-[#24292e]"
            >
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[#e1e4e8] focus-visible:ring-[#0366d6]"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#2da44e] hover:bg-[#2c974b] text-white font-semibold py-6 rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              'Subscribe to Notifications'
            )}
          </Button>
        </form>
        <div className="mt-8 pt-6 border-t border-[#e1e4e8]">
          <h3 className="text-sm font-semibold text-[#24292e] mb-2">
            How it works:
          </h3>
          <ul className="text-sm text-[#444d56] space-y-2 list-disc pl-4">
            <li>
              Enter the repository you want to follow and your email address.
            </li>
            <li>
              We'll send you a confirmation email to verify your subscription.
            </li>
            <li>
              Once confirmed, you'll receive an email every time a new release
              is tagged on GitHub.
            </li>
            <li>
              You can unsubscribe at any time using the link in our emails.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
