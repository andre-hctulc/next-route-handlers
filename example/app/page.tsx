"use client";

import { useLessQuery, useLessStreamer } from "less/src/client";
import { GETArticlesDesc, GETArticlesCountDesc } from "src/api-desc";
import React from "react";
import Article from "./module.Article";
import CreateArticle from "./module.CreateArticle";

const articlesPerPage = 2;

export default function Page() {
    const { data: articlesCount, isError: isCountError } = useLessQuery(GETArticlesCountDesc, {});
    const { page: articles, setSize, error, size } = useLessStreamer(GETArticlesDesc, articlesCount !== undefined && {}, { chunkSize: articlesPerPage });

    if (error || isCountError) return <span>An Error occured 😵‍💫</span>;
    if (articles === undefined) return <span>Loading...</span>;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <CreateArticle />
            {!articles?.length && <p>No articles found</p>}
            {!!articles?.length && (
                <div style={{ display: "flex", flexWrap: "wrap", flexGrow: 1 }}>
                    {articles.map(articleId => (
                        <Article key={articleId} articleId={articleId} />
                    ))}
                </div>
            )}
            <nav style={{ display: "flex", flexDirection: "row" }}>
                {Array.from({ length: articlesCount }).map((_, index) => {
                    const active = size - 1 === index;

                    return (
                        <span key={index} onClick={() => setSize(index)} style={{ textDecoration: active ? "underline" : undefined, cursor: "pointer" }}>
                            {index + 1}
                        </span>
                    );
                })}
            </nav>
        </div>
    );
}
