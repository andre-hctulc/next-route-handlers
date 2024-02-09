import { Article } from "./types";
import { LessError } from "less/src";

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const articlesDb: Map<string, any> = (global as any)["__mem_store"] || ((global as any)["__mem_store"] = new Map());

const articleNotFound = () => new LessError(404, "Article not found");

export async function getArticle(articleId: string): Promise<Article> {
    const article = articlesDb.get(articleId);
    if (!article) articleNotFound();
    return article;
}

export async function createArticle(data: Article): Promise<string> {
    const id = new Date().getTime().toString();
    articlesDb.set(id, { ...data, id });
    return id;
}

export async function deleteArticle(articleId: string): Promise<void> {
    const deleted = articlesDb.delete(articleId);
    if (!deleted) articleNotFound();
}

export async function updateArticle(articleId: string, data: Partial<Article>): Promise<Article> {
    const article = articlesDb.get(articleId);
    if (!article) articleNotFound();
    const newArticle = { ...article, ...data };
    articlesDb.set(articleId, newArticle);
    return newArticle;
}

export async function getArticles(): Promise<string[]> {
    const ids = Object.keys(articlesDb);
    return ids;
}
