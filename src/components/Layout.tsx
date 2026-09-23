import {Outlet} from 'react-router-dom';
import Header from './Header';

function Layout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div>
                <Header/>
                <main className="pt-32 md:pt-24 pb-10">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <Outlet/>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Layout;