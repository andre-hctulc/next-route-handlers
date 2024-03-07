# next-route-handlers

Lightweight react/next library for fetching data from route handlers.

## Features

-   Type safe
-   Client side (memory) caching
-   Dynamic revalidations and mutations, optionally by assigned tags
-   No concurrent fetches for the same route
-   Streamer

## Basic Usage

You can find some of the examples in the _/example_ next project

**1.** Describe the Api with Api-Descriptions

_src/api-desc.ts_

```ts
import type { RHDesc } from "@rh/src";

interface GETArticle {
    articleId: string;
    $response: Article;
}

export const GETArticleDesc: RHDesc<GETArticle> = {
    articleId: { type: "string", in: "query", required: true },
    $response: "object",
    $method: "GET",
    $path: "/api/article",
};

interface PUTArticle {
    articleId: string;
    content?: string;
    title?: string;
    $response: Article;
}

export const PUTArticleDesc: RHDesc<PUTArticle> = {
    articleId: { type: "string", in: "body", required: true },
    content: { type: "string", in: "body" },
    title: { type: "string", in: "body" },
    $response: "object",
    $method: "PUT",
    $path: "/api/article",
};

interface POSTArticle {
    article: Omit<Article, "id">;
    $response: string;
}

export const POSTArticleDesc: RHDesc<POSTArticle> = {
    article: { type: "object", in: "body", required: true },
    $response: "string",
    $method: "POST",
    $path: "/api/article",
};

interface DELETEArticle {
    articleId: string;
    $response: void;
}

export const DELETEArticleDesc: RHDesc<DELETEArticle> = {
    articleId: { type: "string", in: "query", required: true },
    $response: "void",
    $method: "DELETE",
    $path: "/api/article",
};
```

**2.** Write the Route-Handlers

_app/api/article/route.ts_

```ts
import rh from "@rh/src";
import { GETArticleDesc, PUTArticleDesc, POSTArticleDesc, DELETEArticleDesc } from "src/api-desc";
import { Article } from "src/types";
import { getArticle, updateArticle, createArticle, deleteArticle } from "src/acrticles";

export async function GET(...args: any) {
    return await rh(args, GETArticleDesc, async ({ params }) => {
        const article = await getArticle(params.articleId);
        return article;
    });
}

export async function PUT(...args: any) {
    return await rh(args, PUTArticleDesc, async ({ params }) => {
        if (!params.content && !params.title) throw new Error("`content` or `title` is required");
        const newArticle = await updateArticle(params.articleId, { content: params.content, title: params.title });
        return newArticle;
    });
}

export async function POST(...args: any) {
    return await rh(args, POSTArticleDesc, async ({ params }) => {
        const articleId = await createArticle(params.article);
        return articleId;
    });
}

export async function DELETE(...args: any) {
    return await rh(args, DELETEArticleDesc, async ({ params }) => {
        const articleId = params.articleId;
        await deleteArticle(articleId);
    });
}
```

**3.** Query/Mutate client side

Use `useRHQuery` for getting data and `useRHMutation` for posting, updating or deleting data.

_app/article/module.Article.tsx_

```tsx
"use client";

import React from "react";
import { useRHQuery, useRHMutation, useRHCache } from "@rh/src/client";
import { GETArticleDesc, PUTArticleDesc, DELETEArticleDesc } from "src/api-desc";
import { Article } from "src/types";

interface ArticleProps {
    articleId: string;
    style?: React.CSSProperties;
}

export default function Article({ articleId, ...props }: ArticleProps) {
    const { data: article, isError, mutate } = useRHQuery(GETArticleDesc, { articleId });
    const { mutate: updateArticle, isLoading: isUpdating } = useRHMutation(PUTArticleDesc);
    const { mutate: deleteArticle, isLoading: isDeleting } = useRHMutation(DELETEArticleDesc);
    const { revalidateTags } = useRHCache();

    async function updateContent(newContent: string): Promise<Article> {
        const { isError, data: newArticle } = await updateArticle({ articleId, content: newContent });
        if (isError) throw new Error("Failed to update article 😵‍💫");
        return newArticle;
    }

    async function del(): Promise<void> {
        const { isError } = await deleteArticle({ articleId });
        if (isError) throw new Error("Failed to delete article 😵‍💫");
        revalidate(["articles"]);
    }

    if (isError) return <span>Failed to load article 😵‍💫</span>;

    if (!article) return <div className="ArticleSkeleton" style={props.style}></div>;

    return (
        <article style={props.style}>
            <h2>{article.title}</h2>
            {isUpdating && <i>Updating Article...</i>}
            <textarea
                onBlur={e => {
                    const newConent = e.currentTarget.value;
                    if (newConent !== article.content) mutate(updateContent(newConent));
                }}
                defaultValue={article.content}
                disabled={isUpdating || isDeleting}
            />
            <button onClick={() => del()} disabled={isDeleting}>
                Delete Article {isDeleting && "..."}
            </button>
        </article>
    );
}
```

## Streamers

Example:

```tsx
const { page: articles, pages: allArticles, setSize, error, size, revalidate } = useRHStreamer(GETArticlesDesc, {}, { chunkSize: articlesPerPage });
```

## Server API

### RHDesc

| property  | type                                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| \<param\> | `"string" \| "number" \| "object" \| "blob"    \| "stream" \| "any" \| "void" \| "boolean"` |
| $method   | `"GET" \| "POST" \| "PUT" \|  "DELETE"`                                                     |
| $path     | `string`                                                                                    |
| $response | `string`                                                                                    |

### RHError

Throw this inside of `rh` to generate an error response:

```ts
if (!params.articleId) throw new RHError(404, "Bad request: 'articleId' required");
```

...

## Client API

### RHQueryConfig

These options can be used in `useRHQuery` and `useRHStreamer`

| property         | type                             | default value | description                                 |
| ---------------- | -------------------------------- | ------------- | ------------------------------------------- |
| keepPreviousData | `boolean`                        | `false`       | Keeps the data during revalidations         |
| freshTime        | `number`                         | `5000`        | milliseconds                                |
| maxErrRetries    | `number`                         | `3`           |
| errRetryTimeout  | `number`                         | `2000`        | milliseconds                                |
| onError          | `(err: RHFetchError) => void`    | `undefined`   |
| retryOnError     | `(err: RHFetchError) => boolean` | `undefined`   | By default retries will always be performed |
| tags             | `(string \| Falsy)[]`            | `[]`          | Cache tags (for revalidation)               |
| requestInit      | `RequestInit`                    | `undefined`   |
| forceRefetch     | `boolean`                        | `false`       | Ignore fresh data and force fetch           |
| detatch          | `boolean`                        | `false`       | Disable cache use                           |

### Revalidations/Cache mutations

```tsx
const { mutateQuery, revalidateStreamer, revalidateTags, mutateQueries } = useRHCache();
// revalidate/mutate single query
mutateQuery(GETArticleDesc, { articleId: "abc" }, options);
// revalidate a streamer
revalidateStreamer(GETArticlesDesc, {});
// revalidate queries by tags
revalidateTags(["my-articles"]);
// revalidate/mutate multiple queries
mutateQueries(queryState => shouldRevalidate(queryState));
```
