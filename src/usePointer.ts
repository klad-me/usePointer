import { Inputs, useCallback, useEffect, useState } from 'preact/hooks';

/** Pointer coordinates */
export type PointerXY = {
	x: number;
	y: number;
};

/**
 * Coordinates type:<br/>
 * client - using clientX/clientY<br/>
 * page - using pageX/pageY<br/>
 * screen - using screenX/screenY<br/>
 * svg - using clientX/clientY + getBoundingClientRect<br/>
 * function - user defined coordinates transform
 */
export type UsePointerCoordType = 'client' | 'page' | 'screen' | 'svg' | ((evt: MouseEvent) => PointerXY);

const defaultCoord: UsePointerCoordType = 'client';
const defaultMinDragDistance = 15;
const defaultHoldTime = 1000;
const defaultDoubleClickTime = 100;

/**
 * usePointer options
 */
export type UsePointerOptions = {
	/** Coordinates type (default is 'client') */
	coord?: UsePointerCoordType;
	/** Minimum distance to start dragging (default is 15) */
	minDragDistance?: number;
	/** Mouse wheel zoom factor (default is disabled) */
	wheelZoomFactor?: number;
	/** Shift+mouse wheel rotate angle (default is disabled) */
	wheelRotateAngle?: number;
	/** Pointer hold detection time (default is 1000), ms */
	holdTime?: number;
	/** Double click detection time (between unpress and sencond press, default 100), ms */
	doubleClickTime?: number;

	/** Click handler */
	onClick?: (at: PointerXY) => void;
	/** Double click handler */
	onDoubleClick?: (at: PointerXY) => void;
	/** Pointer hold handler */
	onHold?: (at: PointerXY) => void;
	/** Drag handler */
	onDrag?: (from: PointerXY, to: PointerXY, move: PointerXY) => void;
	/** Zoom handler */
	onZoom?: (at: PointerXY, factor: number) => void;
	/** Rotate handler */
	onRotate?: (at: PointerXY, angle: number) => void;
};

/**
 * HTMLElement events used by usePointer
 */
export type UsePointerEvents = {
	onPointerDown: (evt: PointerEvent) => void;
	onPointerUp: (evt: PointerEvent) => void;
	onPointerMove?: (evt: PointerEvent) => void;
	onWheel?: (evt: WheelEvent) => void;
};

type UsePointerState = {
	state: 'idle' | 'pressed' | 'double' | 'hold' | 'drag' | 'zoom';
	timer?: ReturnType<typeof setTimeout>;
	pointerPrev: { [key: number]: PointerXY };
	prevZoomPos?: PointerXY;
	prevZoomDistance?: number;
};

/**
 * Simple hook for handling pointer events (mouse or touch)
 * @param options hook options
 * @param inputs options dependencies
 * @returns events to bind to HTMLElement
 */
export function usePointer(options: UsePointerOptions, inputs: Inputs): UsePointerEvents {
	const [S] = useState<UsePointerState>({
		state: 'idle',
		pointerPrev: [],
	});
	const [handleMove, setHandleMove] = useState(false);

	function resetTimer() {
		if (S.timer !== undefined) {
			clearTimeout(S.timer);
			S.timer = undefined;
		}
	}

	// Clear timer on unmount
	useEffect(() => resetTimer, []);

	const onPointerDown = useCallback((evt: PointerEvent) => {
		const at = getCoord(evt, options.coord);
		S.pointerPrev[evt.pointerId] = at;
		const pressCount = Object.keys(S.pointerPrev).length;

		if (pressCount == 1) {
			if (S.timer !== undefined) {
				// Double-click
				S.state = 'double';
				resetTimer();
				if (options.onDoubleClick) runSafe(options.onDoubleClick.bind(null, at));
			} else {
				// First press
				S.state = 'pressed';
				S.timer = setTimeout(() => {
					S.timer = undefined;
					if (options.onHold) {
						S.state = 'hold';
						runSafe(options.onHold.bind(null, at));
					}
				}, options.holdTime ?? defaultHoldTime);
			}
		} else {
			// Not first press - resetting hold timer
			resetTimer();
		}

		if (pressCount == 2 && S.state == 'pressed') {
			S.state = 'zoom';
			Object.keys(S.pointerPrev).map((id) => (evt.target as HTMLElement).setPointerCapture(Number(id)));
			const p = Object_values(S.pointerPrev);
			S.prevZoomPos = calcMiddle(p[0], p[1]);
			S.prevZoomDistance = calcDistance(p[0], p[1]);
		}

		// Enable mouse tracking
		setHandleMove(true);
	}, inputs);

	const onPointerUp = useCallback((evt: PointerEvent) => {
		delete S.pointerPrev[evt.pointerId];
		const pressCount = Object.keys(S.pointerPrev).length;
		if (pressCount == 0) {
			if (S.state == 'pressed') {
				if (S.timer !== undefined) {
					// Hold timer not over
					resetTimer();

					if (options.onDoubleClick) {
						// Starting double-click timer
						S.timer = setTimeout(() => {
							// Single click if timer is over
							S.timer = undefined;
							if (options.onClick) runSafe(options.onClick.bind(null, getCoord(evt, options.coord)));
						}, options.doubleClickTime ?? defaultDoubleClickTime);
					} else if (options.onClick) {
						// Single click
						runSafe(options.onClick.bind(null, getCoord(evt, options.coord)));
					}
				}
			}
			S.state = 'idle';
			setHandleMove(false);
		}
	}, inputs);

	const onPointerMove = useCallback((evt: PointerEvent) => {
		const cur = getCoord(evt, options.coord);
		const prev = S.pointerPrev[evt.pointerId];
		if (!prev) return;
		const distance = calcDistance(prev, cur);

		switch (S.state) {
			case 'pressed':
				if (distance < (options.minDragDistance ?? defaultMinDragDistance)) break;
				resetTimer();
				(evt.target as HTMLElement).setPointerCapture(evt.pointerId);
				S.state = 'drag';

			case 'drag':
				S.pointerPrev[evt.pointerId] = cur;
				if (options.onDrag) runSafe(options.onDrag.bind(null, prev, cur, { x: cur.x - prev.x, y: cur.y - prev.y }));
				break;

			case 'zoom':
				const prevP = Object_values(S.pointerPrev);
				S.pointerPrev[evt.pointerId] = cur;
				const p = Object_values(S.pointerPrev);
				if (p.length == 2) {
					const at = calcMiddle(p[0], p[1]);
					const dist = calcDistance(p[0], p[1]);
					const zoomFactor = dist / S.prevZoomDistance!;
					const drag = calcDelta(S.prevZoomPos!, at);
					const angle = calcAngle(prevP, p);

					if (options.onZoom && zoomFactor != 1.0) runSafe(options.onZoom.bind(null, at, zoomFactor));

					if (options.onRotate && angle != 0) runSafe(options.onRotate.bind(null, at, angle));

					if (options.onDrag && (drag.x != 0 || drag.y != 0))
						runSafe(options.onDrag.bind(null, S.prevZoomPos!, at, drag));

					S.prevZoomPos = at;
					S.prevZoomDistance = dist;
				}
				break;
		}
	}, inputs);

	const onWheel = useCallback((evt: WheelEvent) => {
		if (evt.shiftKey) {
			// Rotation
			if (options.onRotate && options.wheelRotateAngle)
				runSafe(
					options.onRotate.bind(
						null,
						getCoord(evt, options.coord),
						evt.deltaY > 0 ? options.wheelRotateAngle : -options.wheelRotateAngle,
					),
				);
		} else {
			// Zoom
			if (options.onZoom && options.wheelZoomFactor)
				runSafe(
					options.onZoom.bind(
						null,
						getCoord(evt, options.coord),
						evt.deltaY < 0 ? options.wheelZoomFactor : 1 / options.wheelZoomFactor,
					),
				);
		}
	}, inputs);

	return {
		onPointerDown,
		onPointerUp,
		onPointerMove: handleMove ? onPointerMove : undefined,
		onWheel: options.wheelZoomFactor !== undefined || options.wheelRotateAngle !== undefined ? onWheel : undefined,
	};
}

function getCoord(e: MouseEvent, coord: UsePointerCoordType | undefined): PointerXY {
	if (coord == undefined) coord = defaultCoord;

	if ('function' == typeof coord) return coord(e);

	switch (coord) {
		case 'client':
			return { x: e.clientX, y: e.clientY };

		case 'page':
			return { x: e.pageX, y: e.pageY };

		case 'screen':
			return { x: e.screenX, y: e.screenY };

		case 'svg':
			const bounds = (e.target as SVGGraphicsElement).getBoundingClientRect();
			return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
	}
}

function calcDistance(a: PointerXY, b: PointerXY): number {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcMiddle(a: PointerXY, b: PointerXY): PointerXY {
	return {
		x: (a.x + b.x) / 2,
		y: (a.y + b.y) / 2,
	};
}

function calcDelta(from: PointerXY, to: PointerXY): PointerXY {
	return {
		x: to.x - from.x,
		y: to.y - from.y,
	};
}

function calcAngle(l1: PointerXY[], l2: PointerXY[]): number {
	const dAx = l1[1].x - l1[0].x;
	const dAy = l1[1].y - l1[0].y;
	const dBx = l2[1].x - l2[0].x;
	const dBy = l2[1].y - l2[0].y;
	return Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy) * (180 / Math.PI);
}

function runSafe(cb: () => void) {
	try {
		cb();
	} catch (e) {
		console.error('usePointer callback exception:', e);
	}
}

// Object.values implementation
function Object_values<T>(obj: { [key: string]: T }): T[] {
	return Object.keys(obj).map((key) => obj[key]);
}
