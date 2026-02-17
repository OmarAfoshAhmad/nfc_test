'use client';

export default function GlobalError({ error, reset }) {
    return (
        <html>
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong!</h2>
                    <p className="text-gray-600 mb-8 max-w-md">
                        A critical error occurred. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        Reload Page
                    </button>
                </div>
            </body>
        </html>
    );
}
