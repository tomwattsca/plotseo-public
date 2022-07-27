import React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import logo from '../../assets/logo.png';

interface Props {
  current?: 'dashboard' | 'account' | 'credits' | 'help';
}

const Nav = ({ current }: Props) => {
  return (
    <header className="bg-slate-800 select-none">
      <nav className="px-4 py-2 sm:px-6 lg:px-8" aria-label="Top">
        <div className={`w-full py-1 flex items-center justify-between`}>
          <div className="flex items-center">
            <div>
              <a href="/">
                <span className="sr-only">SEO Ruler</span>
                <img className={`h-6 w-auto rounded-lg`} src={logo} alt="SEO Ruler" />
              </a>
            </div>
            <div className="ml-8 space-x-4">
              <a
                href="/"
                className={`text-base font-medium ${
                  current === 'dashboard' ? 'text-yellow-100' : 'text-sky-200'
                } hover:text-yellow-100 flex items-center`}
              >
                <i className="ri-dashboard-line pr-2" /> Dashboard
              </a>
            </div>
          </div>
          <div className="flex-grow flex items-center justify-center ml-3">
            <div className="uppercase text-xs text-slate-400 tracking-wider">SEO Ruler is currently in BETA</div>
          </div>
          <div className="ml-10 space-x-4"></div>
        </div>
        <div className="py-4 flex flex-wrap justify-center space-x-6 lg:hidden"></div>
      </nav>
    </header>
  );
};

export default Nav;
