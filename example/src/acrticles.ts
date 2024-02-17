import { LessError } from "@less/src";
import { Article } from "./types";

/** Sleep for 100ms-1800ms */
async function sleep() {
    const timeout = Math.floor(Math.random() * (1800 - 100 + 1)) + 100;
    return new Promise(resolve => setTimeout(resolve, timeout));
}

const articlesDb: Map<string, any> = (global as any)["__mem_store"] || ((global as any)["__mem_store"] = new Map());

const articleNotFound = () => new LessError(404, "Article not found");

export async function getArticle(articleId: string): Promise<Article> {
    await sleep();
    const article = articlesDb.get(articleId);
    if (!article) articleNotFound();
    return article;
}

export async function createArticle(data: Omit<Article, "id">): Promise<string> {
    await sleep();
    const id = new Date().getTime().toString();
    articlesDb.set(id, { ...data, id });
    return id;
}

export async function deleteArticle(articleId: string): Promise<void> {
    await sleep();
    const deleted = articlesDb.delete(articleId);
    if (!deleted) articleNotFound();
}

export async function updateArticle(articleId: string, data: Partial<Article>): Promise<Article> {
    await sleep();
    const article = articlesDb.get(articleId);
    if (!article) articleNotFound();
    const newArticle = { ...article };
    for (const key in data) {
        if (data[key as keyof typeof data] !== undefined) newArticle[key] = data[key as keyof typeof data];
    }
    articlesDb.set(articleId, newArticle);
    return newArticle;
}

export async function getArticles(): Promise<string[]> {
    const ids = Array.from(articlesDb.keys());
    return ids;
}
