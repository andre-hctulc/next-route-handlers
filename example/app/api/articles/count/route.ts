import withLess from "less/src";
import { getArticles } from "src/acrticles";
import { GETArticlesCountDesc } from "src/api-desc";

export interface GETArticlesCount {
    $response: number;
}

export async function GET(...args: any) {
    return await withLess(args, GETArticlesCountDesc, async ({ params }) => {
        const articles = await getArticles();
        return articles.length;
    });
}
