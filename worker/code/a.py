# FIDDLE Python Runtime
import sys

print(f"Python version: {sys.version.split()[0]}")

def compute_fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    while len(fib) < n:
        fib.append(fib[-1] + fib[-2])
    return fib

result = compute_fibonacci(8)
print(f"Fibonacci series: {result}")
print("Execution finished successfully.")