let command = "	:A::A:"
let test = command.split(":").filter(part => part === "A"); 

// Function to remove parentheses
function removeParentheses(str) {
  return str.replace(/[()]/g, '');
}

// Example usage
const input = "(A)";
const result = removeParentheses(input);
console.log(result); // Output: A 