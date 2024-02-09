"use client";

import { useLessQuery, useLessMutation } from "less/src/client";
import { GETArticleDesc, PUTArticleDesc, DELETEArticleDesc } from "src/api-desc";
import React from "react";
import { Article } from "src/types";

interface ArticleProps {
    articleId: string;
}

export default function Article({ articleId }: ArticleProps) {
    const { data: article, isError, isLoading, mutate } = useLessQuery(GETArticleDesc, { articleId });
    const { mutate: updateArticle } = useLessMutation(PUTArticleDesc);
    const { mutate: deleteArticle, isLoading: deleteIsLoading } = useLessMutation(DELETEArticleDesc);

    async function updateContent(newContent: string): Promise<Article> {
        const { isError, data: newArticle } = await updateArticle({ articleId, data: { content: newContent } });
        if (isError) throw new Error("Failed to update article 😵‍💫");
        return newArticle;
    }

    async function del(): Promise<void> {
        const { isError } = await deleteArticle({ articleId });
        if (isError) throw new Error("Failed to delete article 😵‍💫");
    }

    if (isError) return <span>Failed to load article 😵‍💫</span>;

    return (
        <section style={{ display: "flex", flexWrap: "wrap" }}>
            <h2>{article ? article.title : "Loading..."}</h2>
            <textarea onBlur={e => mutate(updateContent(e.currentTarget.value))} defaultValue={article.content || ""} disabled={isLoading}>
                {article.content}
            </textarea>
            <button onClick={() => del()} disabled={deleteIsLoading}>
                Delete Article
            </button>
        </section>
    );
}
