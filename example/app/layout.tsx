"use client";

import { LessCacheProvider } from "less/src/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <title>Less Example</title>
                <meta name="description" content="This is a simple less example" />
            </head>
            <body>
                <LessCacheProvider>{children}</LessCacheProvider>
            </body>
        </html>
    );
}
