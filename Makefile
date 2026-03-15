.PHONY: test test-cover lint ci

# M2/M5: make test — UT, no external deps, full mock, < 60s
test:
	node --import tsx --test "test/**/*.test.ts"

# test-cover: UT + coverage report, output to test-result/
test-cover:
	@mkdir -p test-result
	node --import tsx \
		--experimental-test-coverage \
		--test-reporter=tap \
		--test-reporter-destination=test-result/tap.txt \
		--test-reporter=spec \
		--test-reporter-destination=stdout \
		"test/**/*.test.ts"

# M4: lint — TypeScript type check (static, no external deps)
lint:
	npx tsc --noEmit -p tsconfig.json

# M3: ci — lint + test-cover
ci: lint test-cover
