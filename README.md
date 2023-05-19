# usePointer
Simple preact hook for handling pointer (mouse or touch)

## Installation
```bash
npm i @klad-me/usePointer
```

## Documentation
https://klad-me.github.io/docs/usePointer/

## Example
```tsx
function PointerTest()
{
	type Box = {
		x: number;
		y: number;
		size: number;
		rotate: number;
		color: number;
	};

	const colors = [ 'grey', 'red', 'green', 'blue', 'magenta', 'cyan' ]
	const [ box, setBox ] = useState<Box>({ x: 100, y: 100, size: 100, rotate: 0, color: 0 });

	const pointerEvents = usePointer({
		coord: 'page',
		wheelZoomFactor: 1.1,
		wheelRotateAngle: 10,

		onClick: (at: PointerXY) =>
			setBox( (prev) => ({ ...prev, color: (prev.color + 1) % colors.length }) ),
		
		onDoubleClick: (at: PointerXY) =>
			setBox( (prev) => ({ ...prev, color: 0 }) ),
		
		onHold: (at: PointerXY) =>
			setBox( (prev) => ({ ...prev, color: 1 }) ),
		
		onDrag: (from: PointerXY, to: PointerXY, move: PointerXY) =>
			setBox( (prev) => ({ ...prev, x: prev.x + move.x, y: prev.y + move.y })),
		
		onZoom: (at: PointerXY, factor: number) =>
			setBox( (prev) => ({ ...prev, size: prev.size * factor })),
		
		onRotate: (at: PointerXY, angle: number) =>
			setBox( (prev) => ({ ...prev, rotate: prev.rotate + angle })),
	}, []);

	return (
		<div>
			usePointer() hook test
			<div style={
					"touch-action: none;"+
					"position: fixed;"+
					"left: "+(box.x - box.size/2)+"px;"+
					"top: "+(box.y - box.size/2)+"px;"+
					"width: "+box.size+"px;"+
					"height: "+box.size+"px;"+
					"transform: rotate("+box.rotate+"deg);"+
					"background-color: "+colors[box.color]
				}
				{...pointerEvents}
			/>
		</div>
	);
}
```
