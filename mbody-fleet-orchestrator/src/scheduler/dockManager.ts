export interface DockConfig {
  id: string;
  name: string;
  type: 'water' | 'charge' | 'both';
  capacity: number;
  zoneId: string;
  x: number;
  y: number;
}

export interface DockReservation {
  id: string;
  dockId: string;
  robotId: string;
  startMin: number;
  endMin: number;
  taskType: 'water_refill' | 'charge';
}

export interface DockAssignmentResult {
  assignedDockId: string;
  assignedDockName: string;
  decision: 'DIRECT' | 'QUEUE_WAIT' | 'REROUTE_ALT_DOCK';
  startMin: number;
  waitTimeMin: number;
  travelTimeMin: number;
  idleBatteryLossPct: number;
  totalCostMinutes: number; // travel + wait + battery penalty equivalent
  reasoning: string;
}

export class DockCapacityManager {
  private docks: DockConfig[] = [
    { id: 'DOCK-WATER-ALPHA', name: 'Water Dock Alpha (Z1 Main)', type: 'water', capacity: 1, zoneId: 'Z1', x: 10, y: 10 },
    { id: 'DOCK-WATER-BETA', name: 'Water Dock Beta (Z6 Outpatient)', type: 'water', capacity: 1, zoneId: 'Z6', x: 45, y: 30 },
    { id: 'DOCK-CHARGE-MAIN', name: 'Charging Hub Main (Z3 Cafeteria)', type: 'charge', capacity: 2, zoneId: 'Z3', x: 25, y: 20 },
    { id: 'DOCK-CHARGE-ANNEX', name: 'Charging Hub Annex (Z8 Garage)', type: 'charge', capacity: 1, zoneId: 'Z8', x: 80, y: 70 },
  ];

  private reservations: DockReservation[] = [];

  public reset(): void {
    this.reservations = [];
  }

  public getDocks(): DockConfig[] {
    return this.docks;
  }

  public getReservations(): DockReservation[] {
    return [...this.reservations];
  }

  /**
   * Calculates travel time between zones in minutes
   */
  public calculateTravelTimeMinutes(fromZoneId: string, toZoneId: string): number {
    if (fromZoneId === toZoneId) return 0;
    const zoneCoords: Record<string, { x: number; y: number }> = {
      Z1: { x: 10, y: 10 }, Z2: { x: 15, y: 25 }, Z3: { x: 25, y: 20 },
      Z4: { x: 30, y: 40 }, Z5: { x: 20, y: 50 }, Z6: { x: 45, y: 30 },
      Z7: { x: 50, y: 15 }, Z8: { x: 80, y: 70 },
    };
    const p1 = zoneCoords[fromZoneId] || { x: 20, y: 20 };
    const p2 = zoneCoords[toZoneId] || { x: 20, y: 20 };
    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return Math.max(3, Math.round(dist * 0.4)); // ~3-15 minutes
  }

  /**
   * Request dock assignment considering dock capacity, queue wait time, alternative docks, and idle battery loss
   */
  public evaluateAndReserveDock(
    robotId: string,
    currentZoneId: string,
    taskType: 'water_refill' | 'charge',
    requestedStartMin: number,
    durationMin: number
  ): DockAssignmentResult {
    const category = taskType.includes('water') ? 'water' : 'charge';
    const candidateDocks = this.docks.filter(d => d.type === category || d.type === 'both');

    if (candidateDocks.length === 0) {
      throw new Error(`No available docks for task: ${taskType}`);
    }

    // Primary dock is closest to current zone
    const sortedDocks = candidateDocks.sort((a, b) => {
      const travelA = this.calculateTravelTimeMinutes(currentZoneId, a.zoneId);
      const travelB = this.calculateTravelTimeMinutes(currentZoneId, b.zoneId);
      return travelA - travelB;
    });

    const primaryDock = sortedDocks[0];
    const primaryTravelMin = this.calculateTravelTimeMinutes(currentZoneId, primaryDock.zoneId);
    const primaryArrivalMin = requestedStartMin + primaryTravelMin;

    // Check capacity at primary dock at arrival time
    const primaryActiveAtArrival = this.reservations.filter(r => 
      r.dockId === primaryDock.id && 
      !(primaryArrivalMin >= r.endMin || (primaryArrivalMin + durationMin) <= r.startMin)
    );

    if (primaryActiveAtArrival.length < primaryDock.capacity) {
      // Direct access available!
      this.reservations.push({
        id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        dockId: primaryDock.id,
        robotId,
        startMin: primaryArrivalMin,
        endMin: primaryArrivalMin + durationMin,
        taskType
      });

      return {
        assignedDockId: primaryDock.id,
        assignedDockName: primaryDock.name,
        decision: 'DIRECT',
        startMin: primaryArrivalMin,
        waitTimeMin: 0,
        travelTimeMin: primaryTravelMin,
        idleBatteryLossPct: 0,
        totalCostMinutes: primaryTravelMin,
        reasoning: `Direct slot available at ${primaryDock.name} at T+${primaryArrivalMin}m.`
      };
    }

    // Contention detected at primary dock! Calculate Queue Wait vs Alternative Dock Reroute.
    // 1. Queue Option at Primary Dock:
    let queueAvailableMin = primaryArrivalMin;
    while (true) {
      const activeCount = this.reservations.filter(r => 
        r.dockId === primaryDock.id && 
        !(queueAvailableMin >= r.endMin || (queueAvailableMin + durationMin) <= r.startMin)
      ).length;
      if (activeCount < primaryDock.capacity) break;
      queueAvailableMin += 1;
    }

    const queueWaitMin = queueAvailableMin - primaryArrivalMin;
    // Idle battery loss while waiting in queue = 0.15% per min
    const idleBatteryLossPct = Number((queueWaitMin * 0.15).toFixed(2));
    const queueBatteryCostEquivalentMin = idleBatteryLossPct * 2.5;
    const totalQueueCostMin = primaryTravelMin + queueWaitMin + queueBatteryCostEquivalentMin;

    // 2. Alternative Dock Option (if available):
    let bestAltDockResult: { altDock: DockConfig; travelMin: number; totalCostMin: number; arrivalMin: number } | null = null;

    if (sortedDocks.length > 1) {
      const altDock = sortedDocks[1];
      const altTravelMin = this.calculateTravelTimeMinutes(currentZoneId, altDock.zoneId);
      const altArrivalMin = requestedStartMin + altTravelMin;

      const altActiveAtArrival = this.reservations.filter(r => 
        r.dockId === altDock.id && 
        !(altArrivalMin >= r.endMin || (altArrivalMin + durationMin) <= r.startMin)
      );

      if (altActiveAtArrival.length < altDock.capacity) {
        const extraTravelMin = Math.max(0, altTravelMin - primaryTravelMin);
        const travelBatteryPenaltyEquivMin = extraTravelMin * 0.4 * 2.5;
        const totalAltCostMin = altTravelMin + travelBatteryPenaltyEquivMin;

        bestAltDockResult = {
          altDock,
          travelMin: altTravelMin,
          totalCostMin: totalAltCostMin,
          arrivalMin: altArrivalMin
        };
      }
    }

    // Compare Queue vs Reroute
    if (bestAltDockResult && bestAltDockResult.totalCostMin < totalQueueCostMin) {
      // Decision: REROUTE TO ALTERNATIVE DOCK!
      this.reservations.push({
        id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        dockId: bestAltDockResult.altDock.id,
        robotId,
        startMin: bestAltDockResult.arrivalMin,
        endMin: bestAltDockResult.arrivalMin + durationMin,
        taskType
      });

      return {
        assignedDockId: bestAltDockResult.altDock.id,
        assignedDockName: bestAltDockResult.altDock.name,
        decision: 'REROUTE_ALT_DOCK',
        startMin: bestAltDockResult.arrivalMin,
        waitTimeMin: 0,
        travelTimeMin: bestAltDockResult.travelMin,
        idleBatteryLossPct: 0,
        totalCostMinutes: Math.round(bestAltDockResult.totalCostMin),
        reasoning: `Primary dock ${primaryDock.name} full (${primaryActiveAtArrival.length}/${primaryDock.capacity}). Rerouting to ${bestAltDockResult.altDock.name} saves time & battery (Queue wait ${queueWaitMin}m, idle loss ${idleBatteryLossPct}% vs Travel ${bestAltDockResult.travelMin}m).`
      };
    } else {
      // Decision: QUEUE & WAIT AT PRIMARY DOCK!
      this.reservations.push({
        id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        dockId: primaryDock.id,
        robotId,
        startMin: queueAvailableMin,
        endMin: queueAvailableMin + durationMin,
        taskType
      });

      return {
        assignedDockId: primaryDock.id,
        assignedDockName: primaryDock.name,
        decision: 'QUEUE_WAIT',
        startMin: queueAvailableMin,
        waitTimeMin: queueWaitMin,
        travelTimeMin: primaryTravelMin,
        idleBatteryLossPct,
        totalCostMinutes: Math.round(totalQueueCostMin),
        reasoning: `Primary dock ${primaryDock.name} full (${primaryActiveAtArrival.length}/${primaryDock.capacity}). Queueing for ${queueWaitMin}m (idle battery drain: -${idleBatteryLossPct}%) is cheaper than alt dock travel.`
      };
    }
  }
}

export const globalDockManager = new DockCapacityManager();
