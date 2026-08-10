import { FLEET_ROSTER } from '../data/roster';
import { OEMBrand } from '../types';

export interface ComponentDegradationMetrics {
  robotId: string;
  oem: OEMBrand;
  operatingHoursTotal: number;
  motorThermalCycles: number;
  batteryInternalResistanceMOhms: number;
  vibrationMmSec: number;
  pumpDutyCyclePct: number;
  sensorDriftUncertainty: number; // 0.0 to 1.0 scale
}

export interface FailurePredictionResult {
  robotId: string;
  oem: OEMBrand;
  component: 'uv_sanitizer_sensor' | 'water_valve_pump' | 'drive_motor' | 'battery_cell' | 'navigation_lidar';
  timestampMinutes: number; // minutes from 19:00 (0 to 720)
  timeDisplay: string; // e.g. "02:15 AM"
  failureProbability: number; // 0.0 to 1.0 (e.g. 0.85 = 85%)
  confidenceLevelPct: number; // e.g. 95%
  predictedMTTRMinutes: number; // Mean Time To Repair
  primaryRiskFactor: string;
  recommendation: string;
}

export interface RobotFailureCurve {
  robotId: string;
  oem: OEMBrand;
  overallRiskScore: number;
  peakRiskTimeDisplay: string;
  predictionsByTime: { minute: number; timeDisplay: string; probability: number }[];
  topRiskComponent: string;
}

/**
 * Threshold for the LIVE proactive-risk monitor (see simulationEngine.ts's
 * evaluateProactiveRiskMonitoring). 0.5 is chosen deliberately, not as a round
 * number: it sits well above every "nominal" robot's modeled ceiling (R-006 tops
 * out at 0.35, default robots at ~0.04), while still being reachable a genuine
 * ~2+ hours before either scripted incident's actual failure/anomaly time — giving
 * real lead time rather than firing at the exact instant of failure. Contrast with
 * the STATIC scheduler's threshold in optimizer.ts, which only evaluates risk at
 * whatever candidateStartMin a zone's window happens to open — that check can
 * legitimately never fire for a given facility's window configuration, which is
 * the reason this live, clock-driven monitor exists as the primary mechanism.
 */
export const PROACTIVE_RISK_WARNING_THRESHOLD = 0.5;

export class MachineLearningFailurePredictor {
  /**
   * Mock ML Weibull hazard rate & logistic regression failure prediction model
   * Evaluates real-time & historical sensor degradation parameters over shift timeline [0..720] minutes.
   */

  public getComponentDegradationMetrics(robotId: string): ComponentDegradationMetrics {
    const config = FLEET_ROSTER.find(r => r.id === robotId);
    const oem = config ? config.oem : 'AutoScrub';

    switch (robotId) {
      case 'R-003': // AS-900H - High UV/sensor thermal degradation & battery resistance
        return {
          robotId,
          oem,
          operatingHoursTotal: 1420,
          motorThermalCycles: 380,
          batteryInternalResistanceMOhms: 48, // High resistance (+18%)
          vibrationMmSec: 2.1,
          pumpDutyCyclePct: 65,
          sensorDriftUncertainty: 0.82 // High optical sensor drift
        };
      case 'R-008': // FB-200 - Water valve pump stress & coarse sensor lag
        return {
          robotId,
          oem,
          operatingHoursTotal: 1180,
          motorThermalCycles: 290,
          batteryInternalResistanceMOhms: 28,
          vibrationMmSec: 1.8,
          pumpDutyCyclePct: 92, // Severe pump duty cycle stress
          sensorDriftUncertainty: 0.35
        };
      case 'R-001':
      case 'R-002': // AS-900 - Nominal wear
        return {
          robotId,
          oem,
          operatingHoursTotal: 850,
          motorThermalCycles: 210,
          batteryInternalResistanceMOhms: 22,
          vibrationMmSec: 1.1,
          pumpDutyCyclePct: 50,
          sensorDriftUncertainty: 0.12
        };
      case 'R-006': // FB-200 - High vibration on garage concrete
        return {
          robotId,
          oem,
          operatingHoursTotal: 1310,
          motorThermalCycles: 340,
          batteryInternalResistanceMOhms: 32,
          vibrationMmSec: 4.2, // Concrete vibration
          pumpDutyCyclePct: 58,
          sensorDriftUncertainty: 0.22
        };
      default: // CP-X1, CP-V2 Dry vacuum robots
        return {
          robotId,
          oem,
          operatingHoursTotal: 620,
          motorThermalCycles: 150,
          batteryInternalResistanceMOhms: 18,
          vibrationMmSec: 0.9,
          pumpDutyCyclePct: 0,
          sensorDriftUncertainty: 0.15
        };
    }
  }

  /**
   * Predicts component failure probability P(failure | t) for a specific robot at timestamp t.
   */
  public predictRobotFailureAtTime(robotId: string, timestampMinutes: number): FailurePredictionResult {
    const metrics = this.getComponentDegradationMetrics(robotId);
    const timeDisplay = this.minToTimeString(timestampMinutes);

    // Logistic function over degradation features + temporal hazard component
    if (robotId === 'R-003') {
      // Peaks around t = 435 (2:15 AM)
      const deltaT = Math.abs(timestampMinutes - 435);
      const tempFactor = Math.exp(-Math.pow(deltaT / 90, 2));
      const prob = Number((0.08 + 0.77 * tempFactor).toFixed(2));

      return {
        robotId,
        oem: metrics.oem,
        component: 'uv_sanitizer_sensor',
        timestampMinutes,
        timeDisplay,
        failureProbability: Math.min(0.95, prob),
        confidenceLevelPct: 95,
        predictedMTTRMinutes: 180,
        primaryRiskFactor: 'UV-C emitter thermal degradation & sensor optical drift (0.82 index)',
        recommendation: prob > 0.15 ? 'Apply proactive scheduler cost penalty; route away from sterile hospital zones.' : 'Monitor thermal logs.'
      };
    }

    if (robotId === 'R-008') {
      // Peaks around t = 210 (10:30 PM)
      const deltaT = Math.abs(timestampMinutes - 210);
      const tempFactor = Math.exp(-Math.pow(deltaT / 75, 2));
      const prob = Number((0.05 + 0.75 * tempFactor).toFixed(2));

      return {
        robotId,
        oem: metrics.oem,
        component: 'water_valve_pump',
        timestampMinutes,
        timeDisplay,
        failureProbability: Math.min(0.90, prob),
        confidenceLevelPct: 95,
        predictedMTTRMinutes: 45,
        primaryRiskFactor: 'Pump duty cycle stress (92%) & fluid valve seal leakage',
        recommendation: prob > 0.15 ? 'Schedule 10-min dock valve inspection prior to Z6 dispatch.' : 'Inspect coarse float sensor.'
      };
    }

    if (robotId === 'R-006') {
      const prob = Number((0.03 + (timestampMinutes / 720) * 0.08 + (metrics.vibrationMmSec / 10) * 0.05).toFixed(2));
      return {
        robotId,
        oem: metrics.oem,
        component: 'drive_motor',
        timestampMinutes,
        timeDisplay,
        failureProbability: Math.min(0.35, prob),
        confidenceLevelPct: 92,
        predictedMTTRMinutes: 60,
        primaryRiskFactor: 'Rough concrete vibration harmonics (4.2 mm/s)',
        recommendation: 'Re-calibrate wheel dampeners after Z8 garage mission.'
      };
    }

    // Default nominal robots
    const baseProb = Number((0.01 + (timestampMinutes / 720) * 0.03).toFixed(2));
    return {
      robotId,
      oem: metrics.oem,
      component: 'battery_cell',
      timestampMinutes,
      timeDisplay,
      failureProbability: baseProb,
      confidenceLevelPct: 98,
      predictedMTTRMinutes: 30,
      primaryRiskFactor: 'Linear battery discharge wear',
      recommendation: 'Nominal operational status.'
    };
  }

  /**
   * Generates continuous time-series breakdown risk curve across full 12-hour shift (0..720 min)
   */
  public predictRobotFailureCurve(robotId: string): RobotFailureCurve {
    const metrics = this.getComponentDegradationMetrics(robotId);
    const timePoints = [0, 60, 120, 180, 210, 240, 300, 360, 420, 435, 480, 540, 600, 660, 720];

    const predictionsByTime = timePoints.map(min => {
      const pred = this.predictRobotFailureAtTime(robotId, min);
      return {
        minute: min,
        timeDisplay: pred.timeDisplay,
        probability: pred.failureProbability
      };
    });

    let maxPred = predictionsByTime[0];
    predictionsByTime.forEach(p => {
      if (p.probability > maxPred.probability) maxPred = p;
    });

    const topComponent = this.predictRobotFailureAtTime(robotId, maxPred.minute).component;

    return {
      robotId,
      oem: metrics.oem,
      overallRiskScore: maxPred.probability,
      peakRiskTimeDisplay: maxPred.timeDisplay,
      predictionsByTime,
      topRiskComponent: topComponent.toUpperCase().replace(/_/g, ' ')
    };
  }

  /**
   * Returns real-time failure prediction map for all fleet robots at timestamp t.
   */
  public predictFleetFailureRisks(timestampMinutes: number): Map<string, FailurePredictionResult> {
    const riskMap = new Map<string, FailurePredictionResult>();
    FLEET_ROSTER.forEach(r => {
      riskMap.set(r.id, this.predictRobotFailureAtTime(r.id, timestampMinutes));
    });
    return riskMap;
  }

  private minToTimeString(minFrom19: number): string {
    let totalMins = (19 * 60 + minFrom19) % (24 * 60);
    let h = Math.floor(totalMins / 60);
    let m = totalMins % 60;
    const hStr = h < 10 ? `0${h}` : `${h}`;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH < 10 ? '0' + displayH : displayH}:${mStr} ${ampm}`;
  }
}

export const globalFailurePredictor = new MachineLearningFailurePredictor();
