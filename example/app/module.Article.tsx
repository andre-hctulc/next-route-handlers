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
