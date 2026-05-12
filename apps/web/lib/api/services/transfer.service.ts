import apiClient from '../core/client';

export interface InitiateTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number; // in cents
  currency: string;
  note?: string;
}

export interface InitiateTransferResponse {
  executionId: string;
  status: string;
  message?: string;
}

export const transferApi = {
  initiateTransfer: async (request: InitiateTransferRequest): Promise<InitiateTransferResponse> => {
    const response = await apiClient.post<InitiateTransferResponse>(
      '/api/transfers',
      request
    );
    return response.data;
  },
};
