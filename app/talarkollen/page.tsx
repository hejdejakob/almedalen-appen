import { redirect } from 'next/navigation';

export default function TalarkollenRedirect() {
  redirect('/speakers?tab=talarkollen');
}
