export function validatePassword(password: string) {
  if (typeof password === "undefined" || password.length === 0)
    return "Please enter a password.";
  else if (password.length > 120)
    return "Password must be between 8 and 120 characters.";
  else if (password.length < 8)
    return "Password must be between 8 and 120 characters.";
  else if (
    !/(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/g.test(password)
  )
    return "Password must contain at least 1 number and 1 special character.";
}

export function validateEmail(
  email: string | undefined,
  currentEmail?: string,
): string | undefined {
  if (typeof email === "undefined" || email.trim() === "")
    return "Please enter an email.";

  if (currentEmail !== undefined && email === currentEmail)
    return "Your new email must be different from your old one.";

  const emailPattern = /\S+@\S+\.\S+/;

  if (!emailPattern.test(email)) return "Please enter a valid email address.";
}
