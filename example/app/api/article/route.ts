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
        if (params.content === undefined && params.title === undefined) throw new Error("`content` or `title` is required");
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
