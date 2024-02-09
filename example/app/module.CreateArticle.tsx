"use client";

import { useLessMutation } from "less/src/client";
import React from "react";
import { POSTArticleDesc } from "src/api-desc";

interface CreateArticleProps {
    onCreate?: (articleId: string) => void;
    style?: React.CSSProperties;
}

export default function CreateArticle(props: CreateArticleProps) {
    const { mutate } = useLessMutation(POSTArticleDesc);

    async function handleSubmit(data: FormData) {
        const { data: articleId, isError } = await mutate(data);
        if (isError) return alert("An error occured 😵‍💫");
        props.onCreate?.(articleId);
    }

    return (
        <form style={props.style} action={handleSubmit}>
            <input type="text" name="title" />
            <textarea style={{ height: 200 }} name="content" />
            <button>Erstellen</button>
        </form>
    );
}
