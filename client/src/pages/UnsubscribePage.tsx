import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, XCircle, Loader2, Home } from 'lucide-react';

export default function UnsubscribePage() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    const unsubscribe = async () => {
      try {
        const response = await fetch(`/api/unsubscribe/${token}`);
        if (response.ok) {
          setStatus('success');
        } else {
          const data = await response.json();
          setStatus('error');
          setMessage(data.error || 'Invalid or expired unsubscribe link.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while processing your request.');
      }
    };

    unsubscribe();
  }, [token]);

  return (
    <Card className="border-[#e1e4e8] shadow-[0_4px_12px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden">
      <CardHeader className="p-10 pb-6 text-center">
        <div className="flex justify-center mb-6">
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 text-[#0366d6] animate-spin" />
          )}
          {status === 'success' && (
            <Trash2 className="w-16 h-16 text-[#6a737d]" />
          )}
          {status === 'error' && (
            <XCircle className="w-16 h-16 text-[#d73a49]" />
          )}
        </div>
        <CardTitle className="text-2xl font-bold text-[#24292e]">
          {status === 'loading' && 'Unsubscribing...'}
          {status === 'success' && 'Unsubscribed Successfully'}
          {status === 'error' && 'Unsubscribe Failed'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-10 pt-0 text-center">
        {status === 'loading' && (
          <p className="text-base text-[#444d56]">
            Please wait while we process your request.
          </p>
        )}
        {status === 'success' && (
          <>
            <p className="text-base text-[#444d56] mb-8">
              You have been successfully unsubscribed from these release
              notifications. We're sorry to see you go!
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-base text-[#444d56] mb-8">{message}</p>
            <Link
              to="/"
              className="inline-flex items-center text-[#0366d6] hover:underline font-medium"
            >
              Go to Homepage
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
