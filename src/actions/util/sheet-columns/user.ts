"use client";
import { ColumnSheetsImport } from "@/hooks/use-import-csv";
import { useTranslations } from "next-intl";

export function getColumns(): ColumnSheetsImport[] {
     const translate = useTranslations("sheet")
    return [
        {
            title: "firstname",
            require: { req: true, message: translate("required") },
            type: { tp: "string", message: translate("invalidtext") },
            condition: [],
        },
        {
            title: "lastname",
            require: { req: true, message: translate("required") },
            type: { tp: "string", message: translate("invalidtext") },
            condition: [],
        },
        {
            title: "username",
            require: { req: true, message: translate("required") },
            type: { tp: "string", message: translate("invalidtext") },
            condition: [],
        },
        {
            title: "email",
            require: { req: true, message: translate("required") },
            type: { tp: "string", message: translate("invalidtext") },
            condition: [
                { cond: (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), message: translate("invalidemail") },
            ],
        },
        {
            title: "password",
            require: { req: true, message: translate("required") },
            type: { tp: "string", message: translate("invalidtext") },
            condition: [
                { cond: (val: string) => val.length >= 1, message: translate("invalidpassword") },
            ],
        },
    ];
}

