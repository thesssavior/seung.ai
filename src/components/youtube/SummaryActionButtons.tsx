"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import FeedbackModal from "./FeedbackModal";

function toMarkdown(text: string): string {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return text;
    if (!("intro" in data || "body" in data)) return text;

    const parts: string[] = [];
    if (data.intro) parts.push(data.intro);
    if (Array.isArray(data.body)) {
      for (const section of data.body) {
        const heading = [
          section.emoji,
          section.heading,
          section.timestamp ? `(${section.timestamp})` : "",
        ]
          .filter(Boolean)
          .join(" ");
        if (heading) parts.push(`## ${heading}`);
        if (section.content) parts.push(section.content);
      }
    }
    if (data.outro) {
      parts.push("---");
      parts.push(data.outro);
    }
    return parts.join("\n\n");
  } catch {
    return text;
  }
}

interface SummaryActionButtonsProps {
  summaryText: string;
  fileId: string | null;
  isStreaming: boolean;
  onTryAgain: () => void;
}

export default function SummaryActionButtons({
  summaryText,
  fileId,
  isStreaming,
  onTryAgain,
}: SummaryActionButtonsProps) {
  const t = useTranslations();
  const tf = useTranslations("SummaryFeedback");

  const [feedbackGiven, setFeedbackGiven] = useState<"none" | "good" | "bad">("none");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!summaryText || isStreaming) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(summaryText));
      toast.success(t("copiedToClipboard"), {
        description: t("summaryContentCopied"),
      });
    } catch {
      toast.error(t("copyFailed"), {
        description: t("couldNotCopySummary"),
      });
    }
  };

  const submitFeedback = async (
    rating: "good" | "bad",
    reason?: string,
    detail?: string
  ) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/files/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, rating, reason, detail }),
      });
      if (!res.ok) throw new Error();
      setFeedbackGiven(rating);
      toast.success(tf("feedbackSuccess"));
    } catch {
      toast.error(tf("feedbackError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGood = () => {
    if (feedbackGiven === "good") {
      setFeedbackGiven("none");
      return;
    }
    if (feedbackGiven === "bad") return;
    submitFeedback("good");
  };

  const handleBad = () => {
    if (feedbackGiven === "bad") {
      setFeedbackGiven("none");
      return;
    }
    if (feedbackGiven === "good") return;
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = (reason: string, detail: string) => {
    submitFeedback("bad", reason, detail).then(() => {
      setShowFeedbackModal(false);
    });
  };

  return (
    <>
      <div className="not-prose flex items-center gap-1 mt-4 pt-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title={t("copySummary")}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleGood}
          disabled={!fileId}
          title={tf("good")}
        >
          <ThumbsUp className="h-4 w-4" fill={feedbackGiven === "good" ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBad}
          disabled={!fileId}
          title={tf("bad")}
        >
          <ThumbsDown className="h-4 w-4" fill={feedbackGiven === "bad" ? "currentColor" : "none"} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTryAgain} title={tf("tryAgain")}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <FeedbackModal
        open={showFeedbackModal}
        onOpenChange={setShowFeedbackModal}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
