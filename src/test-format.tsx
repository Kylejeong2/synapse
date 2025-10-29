// Test file with bad formatting
import React from "react";

export const TestComponent = () => {
	const [count, setCount] = React.useState(0);
	const message = "hello world";

	return (
		<div>
			<p>{message}</p>
			<button type="button" onClick={() => setCount(count + 1)}>
				Count: {count}
			</button>
		</div>
	);
};
