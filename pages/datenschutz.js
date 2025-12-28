export default function Page() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/datenschutz.html',
      permanent: false,
    },
  };
}