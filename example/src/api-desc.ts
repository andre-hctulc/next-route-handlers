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
