import { createFileRoute } from "@tanstack/react-router";
import { LabApp } from "@/view/lab-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LabApp />;
}
