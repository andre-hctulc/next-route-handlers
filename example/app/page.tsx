"use client";

import { useLessQuery, useLessStreamer } from "@less/src/client";
import { GETArticlesDesc, GETArticlesCountDesc } from "src/api-desc";
import React from "react";
import CreateArticle from "./module.CreateArticle";
import Article from "./module.Article";
import "./app.css";

const articlesPerPage = 2;

export default function ArticlesPage() {
    const { data: articlesCount, isError: isCountError } = useLessQuery(GETArticlesCountDesc, {}, { tags: ["articles"] });
    const {
        page: articles,
        setSize,
        error,
        size,
        revalidate,
    } = useLessStreamer(GETArticlesDesc, articlesCount !== undefined && {}, { chunkSize: articlesPerPage, tags: ["articles"] });

    if (error || isCountError) return <span>An Error occured 😵‍💫</span>;
    if (articles === undefined) return <span>Loading...</span>;

    return (
        <div className="Page">
            <h1>All Articles</h1>
            <a href="#create">Write article</a>
            <button style={{ alignSelf: "start" }} onClick={() => revalidate()}>
                Reload
            </button>
            {!articles?.length && <p>No articles found</p>}
            {articles && (
                <header>
                    <strong>Page {size}</strong>
                    <i>(2 Articles per page)</i>
                </header>
            )}
            {!!articles?.length && (
                <div className="Articles">
                    {articles.map(articleId => (
                        <Article key={articleId} articleId={articleId} />
                    ))}
                </div>
            )}
            <nav>
                {Array.from({ length: Math.ceil(articlesCount / articlesPerPage) }).map((_, index) => {
                    const active = size - 1 === index;

                    return (
                        <span
                            key={index}
                            onClick={() => setSize(index + 1)}
                            style={{
                                textDecoration: active ? "underline" : undefined,
                            }}
                        >
                            {index + 1}
                        </span>
                    );
                })}
            </nav>
            <hr />
            <h2>Write Article</h2>
            <CreateArticle id="create" />
        </div>
    );
}
