'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { plaidApi } from '@/lib/api-client';

interface PlaidLinkButtonProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  userId?: string;
  buttonText?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
}

export default function PlaidLinkButton({
  onSuccess,
  onError,
  userId = 'user-sandbox',
  buttonText = 'Link Bank Account',
  variant = 'default',
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        console.log('Fetching link token...');
        const data = await plaidApi.createLinkToken(userId);
        if (data.link_token) {
          console.log('Link token received:', data.link_token);
          setLinkToken(data.link_token);
        } else {
          console.error('No link token in response:', data);
        }
      } catch (error: any) {
        console.error('Error fetching link token:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        onError?.(error);
      }
    };
    
    fetchLinkToken();
  }, [userId]);

  // Handle successful Plaid Link flow
  const handlePlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    setLoading(true);
    try {
      console.log('Plaid Link success! Public token received:', public_token);
      console.log('Metadata:', metadata);
      console.log('Exchanging public token for access token...');
      
      const exchangeData = await plaidApi.exchangePublicToken(public_token, userId);
      
      console.log('Successfully linked account:', exchangeData);
      onSuccess?.(exchangeData);
    } catch (error: any) {
      console.error('Error exchanging token:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      alert(`Error: ${error.response?.data?.error || error.message}`);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [userId, onSuccess, onError]);

  // Initialize Plaid Link
  const config = {
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: (error: any, metadata: any) => {
      if (error) {
        console.error('Plaid Link exited with error:', error);
        onError?.(error);
      } else {
        console.log('User exited Plaid Link');
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready) {
      console.log('Opening Plaid Link modal...');
      open();
    } else {
      console.log('Plaid Link not ready yet...');
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading || !ready}
      variant={variant}
    >
      {loading ? 'Processing...' : !ready ? 'Loading Link...' : buttonText}
    </Button>
  );
}