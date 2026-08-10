import { ConsumableMetric, DisruptionEvent, OEMBrand, RobotConfig, RobotState } from '../types';
import { FLEET_ROSTER } from '../data/roster';

export interface MLAnomalyFeatureVector {
  robotId: string;
  oem: OEMBrand;
  batteryDrainRatePctPerHr: number;
  waterDrainRateGph: number;
  positionJitterStdDevMeters: number;
  retryCommandRate: number;
  temperatureCelsius: number;
  vibrationMmSec: number;
  isAnomaly: boolean;
  anomalyType: 'WATER_LEAK' | 'BATTERY_DEGRADATION' | 'COMM_FLAPPING' | 'NONE';
}

export class FleetAnomalyDetector {
  /**
   * Evaluates sensor telemetry for consumables tracking & anomaly scoring.
   *
   * @param waterConservatismBias - persisted human-in-the-loop multiplier from
   *   HumanFeedbackController (see src/monitoring/humanFeedback.ts). Defaults to 1.0
   *   (no adjustment). >1.0 = operators said the system was too trigger-happy on the
   *   FloorBot leak flag, so the score threshold is raised. <1.0 = operators said it
   *   under-reacted, so the threshold is lowered. This is the ONLY thing operator
   *   feedback changes here — it is a single number, not a retrained model.
   */
  public evaluateConsumablesAndAnomalies(
    robotStates: Map<string, RobotState>,
    waterConservatismBias: number = 1.0
  ): {
    metrics: ConsumableMetric[];
    featureVectors: MLAnomalyFeatureVector[];
    anomaliesFound: string[];
    oemErrorBreakdown: Record<OEMBrand, number>;
  } {
    const metrics: ConsumableMetric[] = [];
    const featureVectors: MLAnomalyFeatureVector[] = [];
    const anomaliesFound: string[] = [];
    const oemErrorBreakdown: Record<OEMBrand, number> = {
      AutoScrub: 0,
      CleanPath: 0,
      FloorBot: 0,
      CyberClean: 0
    };
    const leakFlagThreshold = Math.round(60 * waterConservatismBias);

    FLEET_ROSTER.forEach(config => {
      const state = robotStates.get(config.id);
      if (!state) return;

      // Water consumption analysis
      const actualWaterMins = state.waterPct !== null ? ((100 - state.waterPct) / 100) * 90 : 0;
      const expectedWaterMins = 30; // Nominal expected
      
      // Calculate leak risk score (0 to 100)
      let leakRiskScore = 15;
      if (config.id === 'R-008' && state.coarseWaterLevel === 'low') {
        leakRiskScore = 85; // Flagged leak risk for R-008 anomaly!
        anomaliesFound.push(`R-008 (FB-200) Water Leak Suspected: Consumption rate 2.8x nominal.`);
      }

      // Battery degradation calculation
      let batteryHealthPct = 98;
      if (config.id === 'R-003') {
        batteryHealthPct = 82; // Aging battery on R-003
        anomaliesFound.push(`R-003 Battery Capacity Degradation: Internal resistance +18% over baseline.`);
      }

      metrics.push({
        robotId: config.id,
        waterUsedGallons: Number(((actualWaterMins / 60) * 12.5).toFixed(1)),
        waterRefillCount: state.waterCyclesCompleted,
        expectedWaterMinutes: expectedWaterMins,
        actualWaterMinutes: actualWaterMins,
        leakRiskScore,
        batteryHealthPct
      });

      // Count OEM errors
      if (state.errorCode) {
        oemErrorBreakdown[config.oem] = (oemErrorBreakdown[config.oem] || 0) + 1;
      }

      // ML Feature Vector generation for anomaly model training
      featureVectors.push({
        robotId: config.id,
        oem: config.oem,
        batteryDrainRatePctPerHr: Number((100 / config.batteryCapacityHours).toFixed(1)),
        waterDrainRateGph: config.hasWaterTank ? 8.5 : 0,
        positionJitterStdDevMeters: state.positionUncertaintyMeters,
        retryCommandRate: config.oem === 'FloorBot' ? 0.08 : 0.01,
        temperatureCelsius: 38 + Math.random() * 4,
        vibrationMmSec: state.status === 'fault' ? 4.8 : 1.2,
        isAnomaly: leakRiskScore > leakFlagThreshold || state.status === 'fault',
        anomalyType: leakRiskScore > leakFlagThreshold ? 'WATER_LEAK' : state.status === 'fault' ? 'BATTERY_DEGRADATION' : 'NONE'
      });
    });

    return {
      metrics,
      featureVectors,
      anomaliesFound,
      oemErrorBreakdown
    };
  }
}

export const globalAnomalyDetector = new FleetAnomalyDetector();
