"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const REASONS = [
  "incorrect",
  "notAsked",
  "slow",
  "style",
  "safety",
  "other",
] as const;

type Reason = (typeof REASONS)[number];

const reasonKeyMap: Record<Reason, string> = {
  incorrect: "reasonIncorrect",
  notAsked: "reasonNotAsked",
  slow: "reasonSlow",
  style: "reasonStyle",
  safety: "reasonSafety",
  other: "reasonOther",
};

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string, detail: string) => void;
  isSubmitting: boolean;
}

export default function FeedbackModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: FeedbackModalProps) {
  const t = useTranslations("SummaryFeedback");
  const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState("");

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, detail);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedReason(null);
      setDetail("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedbackTitle")}</DialogTitle>
          <DialogDescription>{t("feedbackDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {REASONS.map((reason) => (
            <Button
              key={reason}
              variant={selectedReason === reason ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedReason(reason)}
              type="button"
            >
              {t(reasonKeyMap[reason])}
            </Button>
          ))}
        </div>

        <Textarea
          placeholder={t("detailPlaceholder")}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
