import withLess from "@less/src";
import { getArticles } from "src/acrticles";
import { GETArticlesDesc } from "src/api-desc";

export interface GETArticles {
    offset?: number;
    limit?: number;
    $response: string[];
}

export async function GET(...args: any) {
    return await withLess(args, GETArticlesDesc, async ({ params }) => {
        const articles = await getArticles();
        if (params.offset !== undefined && params.limit !== undefined) {
            const start = Math.max(params.offset, 0);
            return articles.slice(start, Math.min(articles.length, start + params.limit));
        }
        return articles;
    });
}
