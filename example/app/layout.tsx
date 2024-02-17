"use client";

import { LessProvider } from "@less/src/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <title>Less Example</title>
                <meta name="description" content="This is a simple less example" />
            </head>
            <body>
                <LessProvider>{children}</LessProvider>
            </body>
        </html>
    );
}
