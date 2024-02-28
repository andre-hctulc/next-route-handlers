# less

Lightweight react api fetching library mainly for NextJS

## Features

-   Type safe and simple api fetching
-   Client side (memory) caching
-   Dynamic revalidations and mutations, optionally by assigned tags
-   No concurrent fetches for the same data source
-   Streamer

## Basic Usage

You can find some of the examples in the _/example_ next project

**1.** Describe the Api with Api-Descriptions

_src/api-desc.ts_

```ts
import type { Desc } from "@less/src";
import type { GETArticle, PUTArticle, POSTArticle, DELETEArticle } from "app/api/article/route";
import type { GETArticles } from "app/api/articles/route";
import type { GETArticlesCount } from "app/api/articles/count/route";

export const GETArticleDesc: Desc<GETArticle> = {
    articleId: { type: "string", in: "query", required: true },
    $response: "object",
    $method: "GET",
    $path: "/api/article",
};

export const PUTArticleDesc: Desc<PUTArticle> = {
    articleId: { type: "string", in: "body", required: true },
    content: { type: "string", in: "body" },
    title: { type: "string", in: "body" },
    $response: "object",
    $method: "PUT",
    $path: "/api/article",
};

export const POSTArticleDesc: Desc<POSTArticle> = {
    article: { type: "object", in: "body", required: true },
    $response: "string",
    $method: "POST",
    $path: "/api/article",
};

export const DELETEArticleDesc: Desc<DELETEArticle> = {
    articleId: { type: "string", in: "query", required: true },
    $response: "void",
    $method: "DELETE",
    $path: "/api/article",
};

export const GETArticlesDesc: Desc<GETArticles> = {
    offset: { type: "number", in: "query" },
    limit: { type: "number", in: "query" },
    $response: "object",
    $method: "GET",
    $path: "/api/articles",
};

export const GETArticlesCountDesc: Desc<GETArticlesCount> = {
    $response: "number",
    $method: "GET",
    $path: "/api/articles/count",
};
```

**2.** Write the Route-Handlers

_app/api/article/route.ts_

```ts
import withLess from "@less/src";
import { GETArticleDesc, PUTArticleDesc, POSTArticleDesc, DELETEArticleDesc } from "src/api-desc";
import { Article } from "src/types";
import { getArticle, updateArticle, createArticle, deleteArticle } from "src/acrticles";

export interface GETArticle {
    articleId: string;
    $response: Article;
}

export async function GET(...args: any) {
    return await withLess(args, GETArticleDesc, async ({ params }) => {
        const article = await getArticle(params.articleId);
        return article;
    });
}

export interface PUTArticle {
    articleId: string;
    content?: string;
    title?: string;
    $response: Article;
}

export async function PUT(...args: any) {
    return await withLess(args, PUTArticleDesc, async ({ params }) => {
        if (!params.content && !params.title) throw new Error("`content` or `title` is required");
        const newArticle = await updateArticle(params.articleId, { content: params.content, title: params.title });
        return newArticle;
    });
}

export interface POSTArticle {
    article: Omit<Article, "id">;
    $response: string;
}

export async function POST(...args: any) {
    return await withLess(args, POSTArticleDesc, async ({ params }) => {
        const articleId = await createArticle(params.article);
        return articleId;
    });
}

export interface DELETEArticle {
    articleId: string;
    $response: void;
}

export async function DELETE(...args: any) {
    return await withLess(args, DELETEArticleDesc, async ({ params }) => {
        const articleId = params.articleId;
        await deleteArticle(articleId);
    });
}
```

**3.** Query/Mutate client side

Use `useLessQuery` for getting data and `useLessMutation` for posting, updating or deleting data.

_app/article/module.Article.tsx_

```tsx
"use client";

import React from "react";
import { useLessQuery, useLessMutation, useMutateTags } from "@less/src/client";
import { GETArticleDesc, PUTArticleDesc, DELETEArticleDesc } from "src/api-desc";
import { Article } from "src/types";

interface ArticleProps {
    articleId: string;
    style?: React.CSSProperties;
}

export default function Article({ articleId, ...props }: ArticleProps) {
    const { data: article, isError, mutate } = useLessQuery(GETArticleDesc, { articleId });
    const { mutate: updateArticle, isLoading: isUpdating } = useLessMutation(PUTArticleDesc);
    const { mutate: deleteArticle, isLoading: isDeleting } = useLessMutation(DELETEArticleDesc);
    const revalidate = useMutateTags();

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

Streamers use mounted fetches to query pages (`useLessQuery().refetch`), so each query is cached on its own.
The streamer as a whole can still be revalidated with `useMutateQuery` or `useMutateTags`

Example:

```tsx
const { page: articles, pages: allArticles, setSize, error, size } = useLessStreamer(GETArticlesDesc, {}, { chunkSize: articlesPerPage });
```

## Server API

### Desc

| property  | type                                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| \<param\> | `"string" \| "number" \| "object" \| "blob"    \| "stream" \| "any" \| "void" \| "boolean"` |
| $method   | `"GET" \| "POST" \| "PUT" \|  "DELETE"`                                                     |
| $path     | `string`                                                                                    |
| $response | `string`                                                                                    |

### LessError

Throw this inside of `withLess` to generate an error response:

```ts
if (!params.articleId) throw new LessError(404, "Bad request: 'articleId' required");
```

...

## Client API

### LessQueryConfig

These options can be used in `useLessQuery` and `useLessStreamer`

| property         | type                               | default value | description                                 |
| ---------------- | ---------------------------------- | ------------- | ------------------------------------------- |
| keepPreviousData | `boolean`                          | `false`       | Keeps the data during revalidations         |
| freshTime        | `number`                           | `5000`        | milliseconds                                |
| maxErrRetries    | `number`                           | `3`           |
| errRetryTimeout  | `number`                           | `2000`        | milliseconds                                |
| onError          | `(err: LessFetchError) => void`    | `undefined`   |
| retryOnError     | `(err: LessFetchError) => boolean` | `undefined`   | By default retries will always be performed |
| tags             | `(string \| Falsy)[]`              | `[]`          | Cache tags (for revalidation)               |
| requestInit      | `RequestInit`                      | `undefined`   |
| forceRefetch     | `boolean`                          | `false`       | Ignore fresh data and force fetch           |
| detatch          | `boolean`                          | `false`       | Disable cache use                           |

### Revalidations

Revalidation mutate the local cache and trigger revalidations

-   Mounted mutations/revalidations: `useLessQuery().mutate` and `useLessStreamer().revalidate`
-   `useMutateQuery(desc, params, options)`: Mutates/revalidates queries or revalidates streamers with the given desc and parameters
-   `useMutateQueries(mutator)`: Mutates/revalidates multiple queries by looking at cache states
-   `useMutateTags(tagsFilter)`: Revalidates queries and streamers by tags

All mutations/revalidations mutate/revalidate all mounted queries that match the filters

...
