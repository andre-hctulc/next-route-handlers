# less

Lightweight Api-Fetching Library designed for NextJS 13

## Features

-   (Memory) Caching
-   Dynamic Revalidations and Mutations
-   No parallel Fetches for the same Data-Source

## Usage

**1.** Describe the Api with Api-Descriptions

\_src/api-desc.ts

```ts
import type { Desc } from "less/src";
import type { GETArticle, PUTArticle, POSTArticle, DELETEArticle } from "app/api/article/route";

export const GETArticleDesc: Desc<GETArticle> = {
    articleId: { type: "string", in: "query", required: true },
    loadArchived: { type: "boolean", in: "query" },
    $response: "object",
    $method: "GET",
    $path: "/api/app/article",
};

export const PUTArticleDesc: Desc<PUTArticle> = {
    articleId: { type: "string", in: "body", required: true },
    data: { type: "object", in: "body", required: true },
    $response: "object",
    $method: "PUT",
    $path: "/api/app/article",
};

export const POSTArticleDesc: Desc<POSTArticle> = {
    article: { type: "object", in: "body", required: true },
    $response: "string",
    $method: "POST",
    $path: "/api/app/article",
};

export const DELETEArticleDesc: Desc<DELETEArticle> = {
    users: { type: "object", in: "query", required: true },
    $response: "void",
    $method: "DELETE",
    $path: "/api/app/article",
};
```

**2.** Write the Route-Handlers

\_app/api/article/route.ts

```ts
import withLess from "less/src";
import { GETAvatarDesc, PUTAvatarDesc } from "src/api-desc";
import { type Article } from "@some-types";
import { getArticle, updateArticle, createArticle, deleteArticle } from "@some-resource";

export interface GETArticle {
    articleId: string;
    $response: Article;
}

export async function GET(...args: any) {
    return await withLess(args, GETAvatarDesc, async ({ params }) => {
        const article = await getArticle(params.articleId, !!params.loadArchived);
        return article;
    });
}

export interface PUTArticle {
    articleId: string;
    data: Partial<Article>;
    $response: Article;
}

export async function PUT(...args: any) {
    return await withLess(args, PUTAvatarDesc, async ({ params }) => {
        const newArticle = await updateArticle(params.articleId, params.article);
        return newArticle;
    });
}

export interface POSTAvatar {
    article: Article;
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
        const articleId = aparams.articleId;
        await deleteArticle(user, params.userId, file);
    });
}
```

**3.** Use on the client

_app/article/module.Article.tsx_

```tsx
"use client";

import { Spinner, ErrorAlert} from "@some-components";
import { useLessQuery, useLessMutation } from "less/src/client";
import { GETArticleDesc, PUTArticleDesc, PostArticleDesc, DELETEArticleDesc } from "src/api-desc";
import { useRouter } from "next/navigation";
import CreateArticle from "app/article/module.CreateArticle";

interface ArticleProps {
    articleId: string;
}

export default function Article({ articleId }: ArticleProps) {
    const router = useRouter();
    const { data: Article, isLoading, isError } = useLessQuery(GETArticleDesc, { articleId: string });
    const { mutate: updateArticle } = useLessMutation(PUTArticleDesc);
    const { mutate: createArticle } = useLessMutation(POSTArticleDesc);

    if (isError) return <ErrorAlert />;
    if (isLoading) return <Spinner />;

    return (
        <div>
            <CreateArticle />
        </div>
    );
}
```

## Server API

## Client API
