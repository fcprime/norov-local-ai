export default function PaymentSuccess() {
  return (
    <div className="auth-page">
      <section className="auth-card auth-card-wide">
        <div className="status-orb">✓</div>
        <h1>Оплату успішно отримано</h1>
        <p className="auth-copy">
          Ми надіслали на email, указаний під час оплати, посилання для створення пароля.
          Перевірте папки «Вхідні», «Спам» і «Промоакції».
        </p>
        <p className="auth-copy">
          Після створення пароля ви зможете увійти в Norov Local AI. Доступ діє 60 днів.
        </p>
        <a className="primary-link" href="/">Перейти до входу</a>
      </section>
    </div>
  )
}
