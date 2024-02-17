"use client";

import { useLessMutation, useMutateTags } from "@less/src/client";
import React from "react";
import { POSTArticleDesc } from "src/api-desc";

interface CreateArticleProps {
    style?: React.CSSProperties;
    id?: string;
}

export default function CreateArticle(props: CreateArticleProps) {
    const { mutate } = useLessMutation(POSTArticleDesc);
    const revalidate = useMutateTags();
    const formRef = React.useRef<HTMLFormElement>(null);

    async function handleSubmit(data: FormData) {
        const title = data.get("title") as string;
        const content = data.get("content") as string;
        const { isError } = await mutate({ article: { content, title } });
        if (isError) return alert("An error occured 😵‍💫");
        revalidate(["articles"]);
        formRef.current?.reset();
    }

    return (
        <form id={props.id} ref={formRef} action={handleSubmit}>
            <label>Title</label>
            <input required type="text" name="title" />
            <label>Content</label>
            <textarea name="content" />
            <button style={{ alignSelf: "center" }}>Erstellen</button>
        </form>
    );
}
