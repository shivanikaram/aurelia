function goProfile() {
  if (!localStorage.getItem("user")) {
    localStorage.setItem("redirectAfterLogin", "profile");
    window.location.href = "login.html";
  } else {
    window.location.href = "profile.html";
  }
}

function goOrders() {
  if (!localStorage.getItem("user")) {
    localStorage.setItem("redirectAfterLogin", "orders");
    window.location.href = "login.html";
  } else {
    window.location.href = "orders.html";
  }
}
