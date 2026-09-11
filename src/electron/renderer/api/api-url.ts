import { type ROUTES } from "@/api/constants/routes.ts";

type ApiWebSocketRoute = (typeof ROUTES)[keyof typeof ROUTES];

export function getApiBaseUrl(): string {
  return `http://${import.meta.env.PUBLIC_API_HOST}:${import.meta.env.PUBLIC_API_PORT}`;
}

export function getApiWebSocketUrl(route: ApiWebSocketRoute): string {
  return `ws://${import.meta.env.PUBLIC_API_HOST}:${import.meta.env.PUBLIC_API_PORT}${route}`;
}
