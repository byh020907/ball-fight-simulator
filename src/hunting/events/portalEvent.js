import { HUNTING_PORTAL_DECLINE } from "../huntingConfig.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { HUNTING_RUN_PHASES, setHuntingRunPhase } from "../huntingState.js";

export class PortalEvent extends HuntingEvent {
    prepareAdvance(run) {
        return { ...run, portalDeclineFloors: HUNTING_PORTAL_DECLINE.INITIAL_FLOORS };
    }

    resolve(event, { run }) {
        return {
            run: setHuntingRunPhase(run, HUNTING_RUN_PHASES.AWAITING_CHOICE),
            transition: HUNTING_EVENT_TRANSITIONS.CHOICE,
            message: `${event.floor}층 — 포탈 발견!`,
            summary: `포탈 발견 · 현재 ${event.floor}층 · 귀환 또는 10층 전진`,
            canRetreat: true,
            logMessage: `[사냥터] ${event.floor}층 — 포탈 발견, 귀환하거나 계속 전진할 수 있습니다.`
        };
    }
}
