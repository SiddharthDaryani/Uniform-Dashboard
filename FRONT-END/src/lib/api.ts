
export interface BackendResponse {
    final: boolean;
    status: string;
    success?: boolean;
    metric?: string;
    group_by?: string;
    filters?: Record<string, string>;
    time_range?: { from: string; to: string } | null;
    data: any[];
    summary?: any;
    message?: string;
}

export const fetchDashboardData = async (question: string): Promise<BackendResponse> => {
    const response = await fetch('http://127.0.0.1:9000/dashboard/query', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    return response.json();
};
