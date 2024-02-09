import withLess from "less/src";
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
        if (params.offset && params.limit && params.offset < articles.length && params.limit + params.limit < articles.length)
            return articles.slice(params.offset, params.offset + params.limit);
        return articles;
    });
}
