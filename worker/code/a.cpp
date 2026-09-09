#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "FIDDLE C++ Runtime Initialized\n";
    
    std::vector<int> numbers = {10, 20, 30, 40, 50};
    int total = 0;
    for (int n : numbers) total += n;
    
    std::cout << "Sum of elements: " << total << "\n";
    std::cout << "Execution completed successfully.\n";
    return 0;
}