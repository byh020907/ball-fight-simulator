function normalizeStep(step, index) {
    if (!step) return null;

    return {
        id: step.id ?? `result-step-${index + 1}`,
        label: step.label ?? "결과",
        text: step.text ?? "",
        subtext: step.subtext ?? "",
        xpReward: step.xpReward ?? null,
        masteryReward: step.masteryReward ?? null
    };
}

export function createResultSequence(steps) {
    const normalizedSteps = (steps ?? []).map(normalizeStep).filter(Boolean);
    if (normalizedSteps.length === 0) {
        throw new Error("결과 시퀀스에는 최소 한 개의 단계가 필요합니다.");
    }

    return {
        steps: normalizedSteps,
        currentIndex: 0
    };
}

export function getResultSequencePresentation(sequence) {
    if (!sequence?.steps?.length) return null;

    const currentIndex = Math.min(Math.max(sequence.currentIndex ?? 0, 0), sequence.steps.length - 1);
    const totalSteps = sequence.steps.length;
    const step = sequence.steps[currentIndex];

    return {
        ...step,
        currentStep: currentIndex + 1,
        totalSteps,
        hasNext: currentIndex < totalSteps - 1,
        isFinal: currentIndex === totalSteps - 1
    };
}

export function advanceResultSequence(sequence) {
    const presentation = getResultSequencePresentation(sequence);
    if (!presentation || presentation.isFinal) return sequence;

    return {
        ...sequence,
        currentIndex: sequence.currentIndex + 1
    };
}
